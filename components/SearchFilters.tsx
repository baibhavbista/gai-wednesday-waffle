import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useWaffleStore } from '../store/useWaffleStore';

interface Group {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface SearchFiltersProps {
  groups: Group[];
  groupMembers: User[];
  onClose: () => void;
  onApply: () => void;
  implicitGroupId?: string;
}

export function SearchFilters({ groups, groupMembers, onClose, onApply, implicitGroupId }: SearchFiltersProps) {
  const { searchFilters, setSearchFilters } = useWaffleStore();
  const [localFilters, setLocalFilters] = useState(searchFilters);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const handleGroupToggle = (groupId: string) => {
    const newGroupIds = localFilters.groupIds.includes(groupId)
      ? localFilters.groupIds.filter(id => id !== groupId)
      : [...localFilters.groupIds, groupId];
    setLocalFilters({ ...localFilters, groupIds: newGroupIds });
  };

  const handleUserToggle = (userId: string) => {
    const newUserIds = localFilters.userIds.includes(userId)
      ? localFilters.userIds.filter(id => id !== userId)
      : [...localFilters.userIds, userId];
    setLocalFilters({ ...localFilters, userIds: newUserIds });
  };

  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (date) {
      setLocalFilters({
        ...localFilters,
        dateRange: {
          ...localFilters.dateRange,
          [type]: date,
        },
      });
    }
  };

  const handleQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setLocalFilters({
      ...localFilters,
      dateRange: { start, end },
    });
  };

  const handleApply = () => {
    setSearchFilters(localFilters);
    onApply();
  };

  const handleReset = () => {
    const resetFilters = {
      groupIds: [],
      userIds: [],
      dateRange: { start: null, end: null },
      mediaType: 'all' as const,
    };
    setLocalFilters(resetFilters);
    setSearchFilters(resetFilters);
  };

  const activeFilterCount = 
    (implicitGroupId ? 1 : 0) +
    localFilters.groupIds.length +
    localFilters.userIds.length +
    (localFilters.dateRange.start ? 1 : 0);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Search Filters</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Date Range Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickDateRange(7)}
              >
                <Text style={styles.chipText}>Last Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickDateRange(30)}
              >
                <Text style={styles.chipText}>Last Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleQuickDateRange(90)}
              >
                <Text style={styles.chipText}>Last 3 Months</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerRow}>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.datePickerLabel}>From:</Text>
                <Text style={styles.datePickerValue}>
                  {localFilters.dateRange.start
                    ? localFilters.dateRange.start.toLocaleDateString()
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.datePickerLabel}>To:</Text>
                <Text style={styles.datePickerValue}>
                  {localFilters.dateRange.end
                    ? localFilters.dateRange.end.toLocaleDateString()
                    : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Groups Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Groups</Text>
            <View style={styles.chipContainer}>
              {/* Show implicit group filter as locked if present */}
              {implicitGroupId && groups.find(g => g.id === implicitGroupId) && (
                <View
                  style={[styles.chip, styles.chipLocked]}
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>
                    {groups.find(g => g.id === implicitGroupId)?.name} (current)
                  </Text>
                </View>
              )}
              {/* Show other groups */}
              {groups
                .filter(group => group.id !== implicitGroupId) // Don't show implicit group in regular list
                .map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.chip,
                      localFilters.groupIds.includes(group.id) && styles.chipActive,
                    ]}
                    onPress={() => handleGroupToggle(group.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        localFilters.groupIds.includes(group.id) && styles.chipTextActive,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>

          {/* Users Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            <View style={styles.chipContainer}>
              {groupMembers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.chip,
                    localFilters.userIds.includes(user.id) && styles.chipActive,
                  ]}
                  onPress={() => handleUserToggle(user.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localFilters.userIds.includes(user.id) && styles.chipTextActive,
                    ]}
                  >
                    {user.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.applyButton]}
            onPress={handleApply}
          >
            <Text style={styles.applyButtonText}>
              Apply Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={localFilters.dateRange.start || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event: any, date?: Date) => {
              setShowStartDatePicker(false);
              if (event.type === 'set' && date) {
                handleDateChange('start', date);
              }
            }}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={localFilters.dateRange.end || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event: any, date?: Date) => {
              setShowEndDatePicker(false);
              if (event.type === 'set' && date) {
                handleDateChange('end', date);
              }
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  resetText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  chipActive: {
    backgroundColor: '#FFD93D',
    borderColor: '#FFD93D',
  },
  chipLocked: {
    backgroundColor: '#FFD93D',
    borderColor: '#FFD93D',
    opacity: 0.8,
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '500',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  datePicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  datePickerLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  datePickerValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#FFD93D',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
}); 