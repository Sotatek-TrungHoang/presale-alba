import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/constants/theme";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  getStripeOnboardingRequirements,
  StripeRequirementsResponse,
} from "@/api/stripe";

type Category =
  | { kind: "document"; side: "front" | "back"; slot: "document" | "additional_document"; raw: string }
  | { kind: "bank"; raw: string }
  | { kind: "individual"; raw: string }
  | { kind: "unknown"; raw: string };

const classify = (field: string): Category => {
  if (field.startsWith("individual.verification.document")) {
    const slot = field.includes("additional_document")
      ? ("additional_document" as const)
      : ("document" as const);
    const side = field.endsWith(".back")
      ? ("back" as const)
      : ("front" as const);
    return { kind: "document", side, slot, raw: field };
  }
  if (field === "external_account") return { kind: "bank", raw: field };
  if (field.startsWith("individual.")) {
    return { kind: "individual", raw: field };
  }
  // tos_acceptance.* and anything else routes to support: there's no
  // standalone re-accept endpoint and ToS re-prompts are extremely rare for
  // transfers-only recipients.
  return { kind: "unknown", raw: field };
};

interface Group {
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  action: () => void;
  raw: string[];
}

const groupRequirements = (
  due: string[],
  handlers: {
    onDocument: (
      side: "front" | "back",
      slot: "document" | "additional_document",
    ) => void;
    onBank: () => void;
    onIndividual: () => void;
    onContactSupport: () => void;
  },
): Group[] => {
  const categorised = due.map(classify);
  const groups: Group[] = [];

  // Document upload: one row per side/slot combination
  const documents = categorised.filter(
    (c): c is Extract<Category, { kind: "document" }> => c.kind === "document",
  );
  documents.forEach((doc) => {
    groups.push({
      title:
        doc.slot === "additional_document"
          ? `Upload additional ID (${doc.side})`
          : `Verify your identity (${doc.side})`,
      description:
        "Stripe needs a photo of your ID to confirm it's you. We'll guide you through it.",
      iconName: "camera-outline",
      action: () => handlers.onDocument(doc.side, doc.slot),
      raw: [doc.raw],
    });
  });

  if (categorised.some((c) => c.kind === "bank")) {
    const raws = categorised.filter((c) => c.kind === "bank").map((c) => c.raw);
    groups.push({
      title: "Update bank details",
      description: "Stripe couldn't validate your bank account. Please re-enter it.",
      iconName: "card-outline",
      action: handlers.onBank,
      raw: raws,
    });
  }

  const individualFields = categorised.filter((c) => c.kind === "individual");
  if (individualFields.length > 0) {
    groups.push({
      title: "Update your personal details",
      description: "Stripe needs more info to verify you. We'll show you the form.",
      iconName: "person-outline",
      action: handlers.onIndividual,
      raw: individualFields.map((c) => c.raw),
    });
  }

  const unknown = categorised.filter((c) => c.kind === "unknown");
  if (unknown.length > 0) {
    groups.push({
      title: "Something else is needed",
      description:
        `Stripe is requesting: ${unknown.map((u) => u.raw).join(", ")}. Our support team can help.`,
      iconName: "help-circle-outline",
      action: handlers.onContactSupport,
      raw: unknown.map((u) => u.raw),
    });
  }

  return groups;
};

export default function StripeRequirements() {
  const [requirements, setRequirements] =
    useState<StripeRequirementsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequirements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await getStripeOnboardingRequirements();
      setRequirements(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRequirements();
    }, [fetchRequirements]),
  );

  const handleDocument = (
    side: "front" | "back",
    slot: "document" | "additional_document",
  ) => {
    // verify-document.tsx is created in the next commit; cast lets the
    // typed-routes generator catch up.
    router.push({
      pathname: "/(app)/stripe-onboarding/verify-document" as any,
      params: { side, slot, mode: "requirements" },
    });
  };
  const handleBank = () => {
    router.push({
      pathname: "/(app)/stripe-onboarding/bank-details",
      params: { mode: "requirements" },
    });
  };
  const handleIndividual = () => {
    router.push({
      pathname: "/(app)/stripe-onboarding/personal-info",
      params: { mode: "requirements" },
    });
  };
  const handleContactSupport = () => {
    Linking.openURL("mailto:support@alba.golf").catch(() =>
      Alert.alert("Couldn't open email", "Please contact support@alba.golf"),
    );
  };

  const groups = requirements
    ? groupRequirements(requirements.currently_due, {
        onDocument: handleDocument,
        onBank: handleBank,
        onIndividual: handleIndividual,
        onContactSupport: handleContactSupport,
      })
    : [];

  const handleDone = () => router.replace("/" as any);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.outer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.title}>Action needed</Text>
          <Text style={styles.subtitle}>
            Stripe needs a little more info before you can receive payouts.
          </Text>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.text.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchRequirements}>
                <Text style={styles.retry}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.center}>
              <Ionicons
                name="checkmark-circle-outline"
                size={64}
                color={colors.semantic.success}
              />
              <Text style={styles.allDone}>You're all set</Text>
              <Text style={styles.allDoneMessage}>
                Nothing left for you to do. Stripe is processing your details.
              </Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.raw.join(",")}
                  style={styles.groupRow}
                  onPress={g.action}
                  activeOpacity={0.8}
                >
                  <View style={styles.groupIcon}>
                    <Ionicons
                      name={g.iconName}
                      size={24}
                      color={colors.primary.yellow}
                    />
                  </View>
                  <View style={styles.groupText}>
                    <Text style={styles.groupTitle}>{g.title}</Text>
                    <Text style={styles.groupDescription}>{g.description}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <SubmitButton title="Done for now" onPress={handleDone} />
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
  },
  center: { alignItems: "center", marginTop: spacing.xl },
  allDone: {
    color: colors.text.primary,
    fontSize: 22,
    fontFamily: typography.fontFamily.semibold,
    marginTop: spacing.lg,
  },
  allDoneMessage: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary.red,
    alignItems: "center",
  },
  errorText: {
    color: colors.primary.red,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.sm,
  },
  retry: {
    color: colors.primary.yellow,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  groupList: { gap: spacing.md },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.black,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  groupText: { flex: 1 },
  groupTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.medium,
  },
  groupDescription: {
    color: colors.text.secondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  buttonContainer: { paddingBottom: spacing.lg },
});
