import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface TermsOfServiceModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function TermsOfServiceModal({
  visible,
  onAccept,
  onDecline,
}: TermsOfServiceModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    setHasScrolledToBottom(isAtBottom);
  };

  const handleAccept = () => {
    Alert.alert(
      'Terms Accepted',
      'By accepting these terms, you agree to follow our community guidelines and understand that violations may result in account suspension.',
      [
        {
          text: 'I Understand',
          onPress: onAccept,
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms of Service & Community Guidelines</Text>
          <TouchableOpacity onPress={onDecline} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.sectionTitle}>Community Guidelines</Text>
          <Text style={styles.text}>
            Alba is a community platform for golfers to connect, organize games, and share their passion for golf. 
            To maintain a safe and welcoming environment for all users, we have established these community guidelines.
          </Text>

          <Text style={styles.sectionTitle}>Zero Tolerance Policy</Text>
          <Text style={styles.text}>
            We have a zero tolerance policy for the following behaviors:
          </Text>
          <Text style={styles.bulletPoint}>
            • Harassment, bullying, or intimidation of any kind
          </Text>
          <Text style={styles.bulletPoint}>
            • Hate speech, discrimination, or offensive language
          </Text>
          <Text style={styles.bulletPoint}>
            • Spam, scams, or fraudulent activities
          </Text>
          <Text style={styles.bulletPoint}>
            • Sharing inappropriate, explicit, or offensive content
          </Text>
          <Text style={styles.bulletPoint}>
            • Impersonation or false representation
          </Text>
          <Text style={styles.bulletPoint}>
            • Sharing personal information without consent
          </Text>

          <Text style={styles.sectionTitle}>Content Moderation</Text>
          <Text style={styles.text}>
            All user-generated content, including messages, profile information, and game-related posts, 
            is subject to our content moderation policies. We use automated systems and human moderators 
            to review content for violations of these guidelines.
          </Text>

          <Text style={styles.sectionTitle}>Reporting System</Text>
          <Text style={styles.text}>
            Users can report inappropriate content or behavior through our reporting system. 
            All reports are reviewed by our moderation team within 24 hours. When violations are confirmed:
          </Text>
          <Text style={styles.bulletPoint}>
            • Offending content will be immediately removed
          </Text>
          <Text style={styles.bulletPoint}>
            • Violating users will be warned or suspended
          </Text>
          <Text style={styles.bulletPoint}>
            • Repeat offenders will be permanently banned
          </Text>

          <Text style={styles.sectionTitle}>Your Responsibilities</Text>
          <Text style={styles.text}>
            By using Alba, you agree to:
          </Text>
          <Text style={styles.bulletPoint}>
            • Respect other users and maintain a positive community atmosphere
          </Text>
          <Text style={styles.bulletPoint}>
            • Report any inappropriate behavior or content you encounter
          </Text>
          <Text style={styles.bulletPoint}>
            • Use the platform only for legitimate golf-related activities
          </Text>
          <Text style={styles.bulletPoint}>
            • Comply with all applicable laws and regulations
          </Text>

          <Text style={styles.sectionTitle}>Consequences of Violations</Text>
          <Text style={styles.text}>
            Violations of these guidelines may result in:
          </Text>
          <Text style={styles.bulletPoint}>
            • Content removal and warnings
          </Text>
          <Text style={styles.bulletPoint}>
            • Temporary account suspension
          </Text>
          <Text style={styles.bulletPoint}>
            • Permanent account termination
          </Text>
          <Text style={styles.bulletPoint}>
            • Legal action in cases of severe violations
          </Text>

          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.text}>
            If you have questions about these guidelines or need to report a violation, 
            please contact our moderation team at: moderation@alba.golf
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={onDecline}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.acceptButton,
              !hasScrolledToBottom && styles.disabledButton,
            ]}
            onPress={handleAccept}
            disabled={!hasScrolledToBottom}
          >
            <Text style={styles.acceptButtonText}>Accept Terms</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  bulletPoint: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 20,
    marginLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.surface,
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neutral.surface,
  },
  acceptButton: {
    backgroundColor: colors.primary.orange,
  },
  disabledButton: {
    backgroundColor: colors.neutral.surface,
  },
  declineButtonText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
  },
  acceptButtonText: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
  },
});

