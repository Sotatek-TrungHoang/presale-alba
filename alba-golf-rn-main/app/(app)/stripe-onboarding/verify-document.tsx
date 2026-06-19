import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { uploadStripeIdentityDocument } from "@/api/stripe";

type Side = "front" | "back";
type Slot = "document" | "additional_document";

export default function VerifyDocument() {
  const params = useLocalSearchParams<{
    side?: string;
    slot?: string;
    mode?: string;
  }>();

  const side: Side = params.side === "back" ? "back" : "front";
  const slot: Slot =
    params.slot === "additional_document" ? "additional_document" : "document";

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "We need camera permission to take a photo of your ID.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
      setError(null);
    }
  };

  const requestLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Library access needed",
        "We need photo library permission to pick a photo of your ID.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!asset || isUploading) return;
    setIsUploading(true);
    setError(null);
    try {
      const fileName =
        asset.fileName ??
        asset.uri.split("/").pop() ??
        `id-${side}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";

      await uploadStripeIdentityDocument({
        fileUri: asset.uri,
        fileName,
        mimeType,
        side,
        slot,
      });

      if (params.mode === "requirements") {
        router.back();
      } else {
        router.replace("/(app)/stripe-onboarding/complete");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      Alert.alert("Upload failed", message);
    } finally {
      setIsUploading(false);
    }
  };

  const title =
    slot === "additional_document"
      ? `Additional ID — ${side}`
      : side === "front"
        ? "Photo of your ID (front)"
        : "Photo of your ID (back)";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.outer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Use your passport or driving licence. Make sure the photo is clear,
            well-lit, and shows all corners of the document.
          </Text>

          {asset ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: asset.uri }}
                style={styles.preview}
                resizeMode="contain"
              />
              <TouchableOpacity
                onPress={() => setAsset(null)}
                style={styles.replaceButton}
              >
                <Ionicons
                  name="close-circle"
                  size={28}
                  color={colors.neutral.white}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={requestCamera}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera-outline"
                  size={28}
                  color={colors.primary.yellow}
                />
                <Text style={styles.pickerButtonText}>Take a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={requestLibrary}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="images-outline"
                  size={28}
                  color={colors.primary.yellow}
                />
                <Text style={styles.pickerButtonText}>Choose from library</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.buttonContainer}>
          {isUploading ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color={colors.text.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <SubmitButton
              title="Submit"
              onPress={handleSubmit}
              disabled={!asset || isUploading}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  outer: { flex: 1, justifyContent: "space-between", padding: spacing.lg },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.lg },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  pickerActions: { gap: spacing.md, marginTop: spacing.lg },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    gap: spacing.md,
  },
  pickerButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  previewWrap: { marginTop: spacing.lg, position: "relative" },
  preview: {
    width: "100%",
    height: 280,
    borderRadius: 8,
    backgroundColor: colors.neutral.surface,
  },
  replaceButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
  },
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary.red,
  },
  errorText: {
    color: colors.primary.red,
    textAlign: "center",
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSizes.sm,
  },
  buttonContainer: { paddingBottom: spacing.lg },
  uploadingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  uploadingText: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
  },
});
