import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface FlaggedContent {
  id: string;
  type: 'MESSAGE' | 'PROFILE' | 'GAME';
  content: string;
  userId: string;
  userName: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export default function ContentReviewScreen() {
  const [flaggedContent, setFlaggedContent] = useState<FlaggedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlaggedContent = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would fetch from your backend
      // For now, we'll simulate the data
      setTimeout(() => {
        setFlaggedContent([
          {
            id: '1',
            type: 'MESSAGE',
            content: 'This is a test message that was flagged for review',
            userId: 'user_123',
            userName: 'John Doe',
            reason: 'profanity',
            severity: 'MEDIUM',
            createdAt: '2024-01-15T10:30:00Z',
            status: 'PENDING',
          },
          {
            id: '2',
            type: 'PROFILE',
            content: 'User bio contains inappropriate content',
            userId: 'user_456',
            userName: 'Jane Smith',
            reason: 'inappropriate',
            severity: 'HIGH',
            createdAt: '2024-01-15T09:15:00Z',
            status: 'PENDING',
          },
        ]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch flagged content:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlaggedContent();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return colors.semantic.error;
      case 'MEDIUM': return colors.semantic.warning;
      case 'LOW': return colors.semantic.success;
      default: return colors.text.disabled;
    }
  };

  const handleApprove = (contentId: string) => {
    Alert.alert(
      'Approve Content',
      'Are you sure this content is appropriate?',
      [
        {
          text: 'Yes, Approve',
          onPress: () => {
            setFlaggedContent(prev => prev.map(item => 
              item.id === contentId ? { ...item, status: 'APPROVED' as const } : item
            ));
            Alert.alert('Success', 'Content has been approved.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleReject = (contentId: string) => {
    Alert.alert(
      'Reject Content',
      'This content will be removed and the user will be warned.',
      [
        {
          text: 'Yes, Remove',
          onPress: () => {
            setFlaggedContent(prev => prev.map(item => 
              item.id === contentId ? { ...item, status: 'REJECTED' as const } : item
            ));
            Alert.alert('Success', 'Content has been removed and user warned.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderContentItem = ({ item }: { item: FlaggedContent }) => (
    <View style={styles.contentCard}>
      <View style={styles.contentHeader}>
        <View style={styles.contentInfo}>
          <Text style={styles.contentType}>
            {item.type} Content
          </Text>
          <Text style={styles.userName}>
            By {item.userName}
          </Text>
          <Text style={styles.contentDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.contentBadges}>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
            <Text style={styles.badgeText}>{item.severity}</Text>
          </View>
          <View style={styles.reasonBadge}>
            <Text style={styles.badgeText}>{item.reason.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.contentPreview}>
        <Text style={styles.contentText}>{item.content}</Text>
      </View>
      
      {item.status === 'PENDING' && (
        <View style={styles.contentActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item.id)}
          >
            <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item.id)}
          >
            <Ionicons name="close" size={16} color={colors.neutral.white} />
            <Text style={styles.actionButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {item.status !== 'PENDING' && (
        <View style={styles.statusIndicator}>
          <Ionicons 
            name={item.status === 'APPROVED' ? 'checkmark-circle' : 'close-circle'} 
            size={20} 
            color={item.status === 'APPROVED' ? colors.semantic.success : colors.semantic.error} 
          />
          <Text style={[styles.statusText, { color: item.status === 'APPROVED' ? colors.semantic.success : colors.semantic.error }]}>
            {item.status}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Content Review</Text>
        <Text style={styles.subtitle}>
          Review flagged content for community guidelines violations
        </Text>
      </View>

      <FlatList
        data={flaggedContent}
        renderItem={renderContentItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchFlaggedContent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="eye-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyStateText}>No flagged content</Text>
            <Text style={styles.emptyStateSubtext}>
              All content has been reviewed!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  contentCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  contentInfo: {
    flex: 1,
  },
  contentType: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },
  contentDate: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.disabled,
  },
  contentBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  severityBadge: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.xs,
  },
  reasonBadge: {
    backgroundColor: colors.text.disabled,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.xs,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
  },
  contentPreview: {
    backgroundColor: colors.neutral.black,
    borderRadius: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  contentText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.primary,
    lineHeight: 20,
  },
  contentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: colors.semantic.success,
  },
  rejectButton: {
    backgroundColor: colors.semantic.error,
  },
  actionButtonText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

