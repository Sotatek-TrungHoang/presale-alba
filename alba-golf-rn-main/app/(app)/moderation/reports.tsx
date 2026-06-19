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

interface Report {
  id: string;
  targetType: 'USER' | 'CONVERSATION' | 'GAME';
  targetId: string;
  reason: 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'SCAM' | 'OTHER';
  description?: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('PENDING');

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would fetch from your backend
      // For now, we'll simulate the data
      setTimeout(() => {
        setReports([
          {
            id: '1',
            targetType: 'CONVERSATION',
            targetId: 'conv_123',
            reason: 'HARASSMENT',
            description: 'User sent threatening messages',
            reporterId: 'user_456',
            reporterName: 'John Doe',
            createdAt: '2024-01-15T10:30:00Z',
            status: 'PENDING',
            severity: 'HIGH',
          },
          {
            id: '2',
            targetType: 'USER',
            targetId: 'user_789',
            reason: 'SPAM',
            description: 'User is posting promotional content repeatedly',
            reporterId: 'user_101',
            reporterName: 'Jane Smith',
            createdAt: '2024-01-15T09:15:00Z',
            status: 'PENDING',
            severity: 'MEDIUM',
          },
          {
            id: '3',
            targetType: 'GAME',
            targetId: 'game_456',
            reason: 'INAPPROPRIATE',
            description: 'Game organizer used offensive language',
            reporterId: 'user_202',
            reporterName: 'Mike Johnson',
            createdAt: '2024-01-14T16:45:00Z',
            status: 'RESOLVED',
            severity: 'MEDIUM',
          },
        ]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return colors.semantic.error;
      case 'MEDIUM': return colors.semantic.warning;
      case 'LOW': return colors.semantic.success;
      default: return colors.text.disabled;
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'HARASSMENT': return colors.semantic.error;
      case 'SPAM': return colors.semantic.warning;
      case 'INAPPROPRIATE': return colors.semantic.error;
      case 'SCAM': return colors.semantic.error;
      case 'OTHER': return colors.text.secondary;
      default: return colors.text.disabled;
    }
  };

  const handleResolveReport = (reportId: string) => {
    Alert.alert(
      'Resolve Report',
      'How would you like to resolve this report?',
      [
        {
          text: 'Remove Content',
          onPress: () => {
            setReports(prev => prev.map(r => 
              r.id === reportId ? { ...r, status: 'RESOLVED' as const } : r
            ));
            Alert.alert('Success', 'Content has been removed and user has been warned.');
          },
        },
        {
          text: 'Ban User',
          onPress: () => {
            setReports(prev => prev.map(r => 
              r.id === reportId ? { ...r, status: 'RESOLVED' as const } : r
            ));
            Alert.alert('Success', 'User has been banned from the platform.');
          },
        },
        {
          text: 'Dismiss',
          onPress: () => {
            setReports(prev => prev.map(r => 
              r.id === reportId ? { ...r, status: 'DISMISSED' as const } : r
            ));
            Alert.alert('Success', 'Report has been dismissed.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const filteredReports = reports.filter(report => {
    if (filter === 'ALL') return true;
    return report.status === filter;
  });

  const renderReportItem = ({ item }: { item: Report }) => (
    <TouchableOpacity style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportInfo}>
          <Text style={styles.reportType}>
            {item.targetType} Report
          </Text>
          <View style={styles.reportMeta}>
            <Text style={styles.reporterName}>
              Reported by {item.reporterName}
            </Text>
            <Text style={styles.reportDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.reportBadges}>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
            <Text style={styles.badgeText}>{item.severity}</Text>
          </View>
          <View style={[styles.reasonBadge, { backgroundColor: getReasonColor(item.reason) }]}>
            <Text style={styles.badgeText}>{item.reason}</Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.reportDescription}>
        {item.description || 'No description provided'}
      </Text>
      
      {item.status === 'PENDING' && (
        <View style={styles.reportActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={() => handleResolveReport(item.id)}
          >
            <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
            <Text style={styles.actionButtonText}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.dismissButton]}
            onPress={() => {
              setReports(prev => prev.map(r => 
                r.id === item.id ? { ...r, status: 'DISMISSED' as const } : r
              ));
            }}
          >
            <Ionicons name="close" size={16} color={colors.text.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {item.status !== 'PENDING' && (
        <View style={styles.statusIndicator}>
          <Ionicons 
            name={item.status === 'RESOLVED' ? 'checkmark-circle' : 'close-circle'} 
            size={20} 
            color={item.status === 'RESOLVED' ? colors.semantic.success : colors.text.disabled} 
          />
          <Text style={[styles.statusText, { color: item.status === 'RESOLVED' ? colors.semantic.success : colors.text.disabled }]}>
            {item.status}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={styles.filterButtons}>
          {(['ALL', 'PENDING', 'RESOLVED'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterButton,
                filter === filterType && styles.activeFilterButton,
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterType && styles.activeFilterButtonText,
                ]}
              >
                {filterType}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredReports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchReports} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyStateText}>No reports found</Text>
            <Text style={styles.emptyStateSubtext}>
              {filter === 'PENDING' 
                ? 'All reports have been resolved!' 
                : 'No reports match the current filter.'}
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
    marginBottom: spacing.md,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.neutral.surface,
  },
  activeFilterButton: {
    backgroundColor: colors.primary.orange,
  },
  filterButtonText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
  },
  activeFilterButtonText: {
    color: colors.neutral.white,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reportInfo: {
    flex: 1,
  },
  reportType: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reportMeta: {
    gap: spacing.xxs,
  },
  reporterName: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.secondary,
  },
  reportDate: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.disabled,
  },
  reportBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  severityBadge: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.xs,
  },
  reasonBadge: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.xs,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.neutral.white,
  },
  reportDescription: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  reportActions: {
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
  resolveButton: {
    backgroundColor: colors.semantic.success,
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neutral.surface,
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

