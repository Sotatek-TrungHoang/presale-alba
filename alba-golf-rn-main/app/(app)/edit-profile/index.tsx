import React from "react";
import { router } from "expo-router";
import { useAuth } from "@/providers/Auth";
import { colors, spacing, typography } from "@/constants/theme";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useProfileStore } from "@/stores/profileStore";
import { Heading, StyledInput, SubmitButton } from "@/components/ui";
import { useState, useEffect } from "react";
import {
  GameType,
  HandicapRange,
  PlayerType,
  TimeSlot,
  updateUserProfile,
  getPresignedUrl,
} from "@/api/user";
import { getGameTypeStyle } from "@/utils/formatters";
import * as ImagePicker from "expo-image-picker";

const ALL_HANDICAP_RANGES = Object.values(HandicapRange);
const ALL_PLAYER_TYPES = Object.values(PlayerType);
const ALL_GAME_TYPES = Object.values(GameType);

const PLAYER_TYPE_STYLE_PALETTE = [
  {
    backgroundColor: "#4A4129",
    borderColor: colors.primary.yellow,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4F362A",
    borderColor: colors.primary.orange,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#442222",
    borderColor: colors.primary.red,
    textColor: colors.text.primary,
  },
  {
    backgroundColor: "#4D3240",
    borderColor: colors.primary.pink,
    textColor: colors.text.primary,
  },
];

const formatEnumText = (text: string) => {
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

const getPlayerTypeStyleFromPalette = (playerType: PlayerType) => {
  const index = ALL_PLAYER_TYPES.indexOf(playerType);
  return PLAYER_TYPE_STYLE_PALETTE[index % PLAYER_TYPE_STYLE_PALETTE.length];
};

type TabType = "personal" | "play" | "availability";

export default function EditProfilePage() {
  const { user } = useAuth();
  const {
    profile: profileData,
    loadingProfile,
    profileError,
    fetchProfile,
  } = useProfileStore();

  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [selectedHandicapRange, setSelectedHandicapRange] = useState<
    HandicapRange | undefined
  >(undefined);
  const [selectedPlayerType, setSelectedPlayerType] = useState<
    PlayerType | undefined
  >(undefined);
  const [selectedPreferences, setSelectedPreferences] = useState<GameType[]>(
    []
  );
  // Availability moved to dedicated page
  const [isSaving, setIsSaving] = useState(false);
  const [isNameInputFocused, setIsNameInputFocused] = useState(false);

  useEffect(() => {
    if (profileData) {
      setFirstName(profileData.profile?.first_name || "");
      setLastName(profileData.profile?.last_name || "");
      setProfilePhoto(profileData.profile?.photo);
      setSelectedHandicapRange(profileData.onboarding?.handicap_range);
      setSelectedPlayerType(profileData.onboarding?.player_type);
      setSelectedPreferences(profileData.onboarding?.preferences || []);

      // Availability is now handled on a separate page
    }
  }, [profileData]);

  const { profile } = profileData;

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>Please login to view golfers.</Text>
      </View>
    );
  }

  if (loadingProfile) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
      </View>
    );
  }

  if (profileError) {
    console.log(profileError);
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>Something went wrong...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>No profile data</Text>
      </View>
    );
  }

  const togglePreference = (preference: GameType) => {
    setSelectedPreferences((prev) =>
      prev.includes(preference)
        ? prev.filter((p) => p !== preference)
        : [...prev, preference]
    );
  };

  // Availability handlers moved to dedicated page

  const handleChoosePhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to update your profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        await handleImageUpload(selectedImage);
      }
    } catch (error) {
      console.error("Error choosing photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const handleImageUpload = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      const fileName = image.uri.split("/").pop() || "profile-photo.jpg";
      const fileType = image.mimeType || "image/jpeg";

      // Get presigned URL for upload
      const presignedData = await getPresignedUrl({
        fileName,
        fileType,
      });

      // Create form data for upload
      const formData = new FormData();
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      formData.append("file", {
        uri: image.uri,
        type: fileType,
        name: fileName,
      } as any);

      // Upload to S3
      const uploadResponse = await fetch(presignedData.url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Construct the final S3 URL
      const imageUrl = `https://${presignedData.bucketName}.s3.${presignedData.region}.amazonaws.com/${presignedData.objectKey}`;
      setProfilePhoto(imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const profileUpdateData = {
        first_name: firstName,
        last_name: lastName,
        photo: profilePhoto,
        handicapRange: selectedHandicapRange,
        playerType: selectedPlayerType,
        preferences: selectedPreferences,
      };

      await updateUserProfile(profileUpdateData);

      // Get a fresh token and refresh the profile
      if (user) {
        await fetchProfile();
      }

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderPersonalInfo = () => (
    <>
      <View style={styles.nameContainer}>
        <View style={styles.nameInputContainer}>
          <Text style={styles.personalInfoLabel}>First Name</Text>
          <StyledInput
            placeholder="First Name"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
            }}
            onFocus={() => setIsNameInputFocused(true)}
            onBlur={() => setIsNameInputFocused(false)}
          />
        </View>
        <View style={styles.nameInputContainer}>
          <Text style={styles.personalInfoLabel}>Last Name</Text>
          <StyledInput
            placeholder="Last Name"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
            }}
            onFocus={() => setIsNameInputFocused(true)}
            onBlur={() => setIsNameInputFocused(false)}
          />
        </View>
      </View>
    </>
  );

  const renderPlayDetails = () => (
    <View style={styles.onboardingContainer}>
      <Text style={styles.onboardingLabel}>Handicap</Text>
      <View style={styles.optionGroup}>
        {ALL_HANDICAP_RANGES.map((range) => {
          const isSelected = selectedHandicapRange === range;
          return (
            <TouchableOpacity
              key={range}
              style={[
                styles.optionButton,
                isSelected && styles.selectedOptionButton,
              ]}
              onPress={() => setSelectedHandicapRange(range)}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.selectedOptionButton,
                ]}
              >
                {formatEnumText(range)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.onboardingLabel}>Player Type</Text>
      <View style={styles.optionGroup}>
        {ALL_PLAYER_TYPES.map((type) => {
          const isSelected = selectedPlayerType === type;
          let playerTypeSpecificStyle = {};
          let playerTypeTextSpecificStyle = {};

          if (isSelected) {
            const styleInfo = getPlayerTypeStyleFromPalette(type);
            playerTypeSpecificStyle = {
              backgroundColor: styleInfo.backgroundColor,
              borderColor: styleInfo.borderColor,
            };
            playerTypeTextSpecificStyle = { color: styleInfo.textColor };
          }

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionButton,
                isSelected && playerTypeSpecificStyle,
              ]}
              onPress={() => setSelectedPlayerType(type)}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.selectedOptionText,
                  isSelected && playerTypeTextSpecificStyle,
                ]}
              >
                {formatEnumText(type)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.onboardingLabel}>Game Preferences</Text>
      <View style={styles.optionGroup}>
        {ALL_GAME_TYPES.map((preference) => {
          const isSelected = selectedPreferences.includes(preference);
          let gameTypeStyle = {};

          if (isSelected) {
            const styleFromFormatter = getGameTypeStyle(preference);
            gameTypeStyle = styleFromFormatter.lozengeStyle;
          }

          return (
            <TouchableOpacity
              key={preference}
              style={[
                styles.optionButton,
                isSelected && gameTypeStyle,
                isSelected &&
                  !gameTypeStyle.hasOwnProperty("borderColor") &&
                  styles.selectedOptionButtonGenericBorder,
              ]}
              onPress={() => togglePreference(preference)}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.selectedPreferenceText,
                ]}
              >
                {formatEnumText(preference)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Availability UI moved to dedicated page

  const renderActiveTab = () => {
    switch (activeTab) {
      case "personal":
        return renderPersonalInfo();
      case "play":
        return renderPlayDetails();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {!isNameInputFocused && (
        <TouchableOpacity
          style={styles.profilePictureContainer}
          onPress={handleChoosePhoto}
        >
          <View
            style={[
              profilePhoto
                ? styles.profilePicture
                : styles.profilePicturePlaceholder,
              styles.imageContainer,
            ]}
          >
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.profilePicture}
              />
            ) : (
              <Text style={styles.placeholderText}>
                {firstName && lastName
                  ? `${firstName[0]}${lastName[0]}`
                  : "Add Photo"}
              </Text>
            )}
          </View>
          <View style={styles.editOverlay}>
            <Text style={styles.editText}>Edit</Text>
          </View>
        </TouchableOpacity>
      )}
      {!(isNameInputFocused && Platform.OS === "android") && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "personal" && styles.activeTab]}
            onPress={() => setActiveTab("personal")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "personal" && styles.activeTabText,
              ]}
            >
              Personal Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "play" && styles.activeTab]}
            onPress={() => setActiveTab("play")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "play" && styles.activeTabText,
              ]}
            >
              Play Details
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView style={styles.scrollView}>
        <View style={styles.scrollContainer}>{renderActiveTab()}</View>
      </ScrollView>
      <View style={styles.buttonContainer}>
        <SubmitButton
          title="Save Changes"
          isLoading={isSaving}
          onPress={handleSave}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  scrollView: {
    flex: 1,
    width: "100%",
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  scrollContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.xs,
  },
  profilePictureContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.md,
    position: "relative",
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profilePicture: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  profilePicturePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.neutral.surface,
  },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: 70,
    borderBottomRightRadius: 70,
  },
  editText: {
    color: colors.text.primary,
    textAlign: "center",
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
  },
  nameContainer: {
    gap: spacing.sm,
    width: "100%",
    paddingHorizontal: spacing.md,
  },
  personalInfoLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.light,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  nameInputContainer: {
    gap: spacing.sm,
  },
  onboardingContainer: {
    gap: spacing.sm,
    width: "100%",
    paddingHorizontal: spacing.md,
  },
  onboardingLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.light,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.sm,
  },
  optionText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
  },
  selectedPreferenceText: {
    fontFamily: typography.fontFamily.medium,
    color: colors.text.primary,
  },
  selectedOptionText: {
    fontFamily: typography.fontFamily.medium,
    color: colors.neutral.black,
  },
  optionButton: {
    backgroundColor: colors.neutral.black,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.text.primary,
    color: colors.text.primary,
  },
  selectedOptionButton: {
    backgroundColor: colors.primary.yellow,
    borderColor: colors.primary.yellow,
    color: colors.neutral.black,
  },
  selectedOptionButtonGenericBorder: {
    borderColor: colors.primary.yellow,
  },
  buttonContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.neutral.black,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: colors.primary.orange,
  },
  tabText: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
  },
  activeTabText: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
  },
  placeholderText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.medium,
    textTransform: "uppercase",
  },
});
