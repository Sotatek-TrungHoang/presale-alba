import React from "react";
import { View, StyleSheet } from "react-native";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface UserFollowButtonProps {
  isFollowing: boolean;
  isLoading: boolean;
  onPress: () => void;
}

export const UserFollowButton: React.FC<UserFollowButtonProps> = ({
  isFollowing,
  isLoading,
  onPress,
}) => (
  <View style={styles.followButtonContainer}>
    <SubmitButton
      title={isFollowing ? "Unfollow" : "Follow"}
      variant={isFollowing ? "outline" : "primary"}
      onPress={onPress}
      isLoading={isLoading}
      fullWidth={true}
      style={styles.followButton}
    />
  </View>
);

const styles = StyleSheet.create({
  followButtonContainer: {
    width: "100%",
  },
  followButton: {
    height: 48,
  },
});
