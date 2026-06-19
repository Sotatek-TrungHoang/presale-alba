import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ModerationStats {
  pendingReports: number;
  resolvedReports: number;
  flaggedContent: number;
  bannedUsers: number;
  totalReports: number;
}

export default function ModerationDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<ModerationStats>({
    pendingReports: 0,
    resolvedReports: 0,
    flaggedContent: 0,
    bannedUsers: 0,
    totalReports: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would fetch from your backend
      // For now, we'll simulate the data
      setTimeout(() => {
        setStats({
          pendingReports: 12,
          resolvedReports: 45,
          flaggedContent: 8,
          bannedUsers: 3,
          totalReports: 57,
        });
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch moderation stats:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    onPress 
  }: { 
    title: string; 
    value: number; 
    icon: string; 
    color: string; 
    onPress?: () => void; 
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <Ionicons name={icon as any} size={24} color={color} />
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const QuickAction = ({ 
    title, 
    description, 
    icon, 
    onPress 
  }: { 
    title: string; 
    description: string; 
    icon: string; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionContent}>
        <Ionicons name={icon as any} size={32} color={colors.primary.orange} />
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDescription}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchStats} />
        }
      >
        <Text style={styles.title}>Moderation Dashboard</Text>
        <Text style={styles.subtitle}>
          Monitor and manage user-generated content
        </Text>

        <View style={styles.statsGrid}>
          <StatCard
            title="Pending Reports"
            value={stats.pendingReports}
            icon="flag-outline"
            color={colors.semantic.warning}
            onPress={() => router.push('/moderation/reports')}
          />
          <StatCard
            title="Resolved Reports"
            value={stats.resolvedReports}
            icon="checkmark-circle-outline"
            color={colors.semantic.success}
          />
          <StatCard
            title="Flagged Content"
            value={stats.flaggedContent}
            icon="warning-outline"
            color={colors.semantic.error}
            onPress={() => router.push('/moderation/content-review')}
          />
          <StatCard
            title="Banned Users"
            value={stats.bannedUsers}
            icon="person-remove-outline"
            color={colors.text.disabled}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <QuickAction
          title="Review Reports"
          description="Review and act on user reports"
          icon="list-outline"
          onPress={() => router.push('/moderation/reports')}
        />
        
        <QuickAction
          title="Content Review"
          description="Review flagged content and messages"
          icon="eye-outline"
          onPress={() => router.push('/moderation/content-review')}
        />
        
        <QuickAction
          title="User Management"
          description="Manage user accounts and permissions"
          icon="people-outline"
          onPress={() => {
            Alert.alert('Coming Soon', 'User management features will be available in a future update.');
          }}
        />

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary.orange} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>24-Hour Response Policy</Text>
            <Text style={styles.infoText}>
              All reports must be reviewed and acted upon within 24 hours. 
              Use the quick actions above to manage reports efficiently.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: '45%',
  },
  statContent: {
    gap: spacing.xs,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  actionCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  infoCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});

