import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { wafflesService } from './database-service';

// Configure notification handler - how notifications should be presented when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show notification when app is in foreground
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

// Storage keys
const NOTIFICATION_IDS_KEY = 'wednesday-waffle-notification-ids';

// Notification messages
const MORNING_MESSAGE = "Time to share your Wednesday waffle! 🧇";
const EVENING_MESSAGE = "Don't let Wednesday slip away! Share your waffle 🧇";

export class NotificationService {
  /**
   * Request notification permissions from the user
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get current permission status
   */
  static async getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  /**
   * Calculate the current ISO week (Sunday-Saturday)
   */
  static getCurrentISOWeek(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // Adjust for Sunday being start of week
    const dayOfWeek = now.getDay() || 7;
    const mondayOfWeek = new Date(now.getTime() - (dayOfWeek === 7 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
    
    // Calculate week number
    const weekNumber = Math.ceil((dayOfYear - (7 - startOfYear.getDay())) / 7);
    
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Check if user has posted this week
   */
  static async hasPostedThisWeek(userId: string): Promise<boolean> {
    try {
      const currentWeek = this.getCurrentISOWeek();
      
      // Check profile for cached week
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_waffle_week')
        .eq('id', userId)
        .single();
      
      return profile?.last_waffle_week === currentWeek;
    } catch (error) {
      console.error('Error checking weekly post status:', error);
      return false;
    }
  }

  /**
   * Get next Wednesday dates (9AM and 8PM) for the next 4 weeks
   */
  static getNextWednesdayDates(): { id: string; date: Date; isEvening: boolean }[] {
    const dates: { id: string; date: Date; isEvening: boolean }[] = [];
    const now = new Date();
    
    // Start from current date
    let checkDate = new Date(now);
    
    for (let week = 0; week < 4; week++) {
      // Find next Wednesday
      while (checkDate.getDay() !== 3) { // 3 = Wednesday
        checkDate.setDate(checkDate.getDate() + 1);
      }
      
      // Set morning time (9 AM)
      const morningDate = new Date(checkDate);
      morningDate.setHours(9, 0, 0, 0);
      
      // Set evening time (8 PM)
      const eveningDate = new Date(checkDate);
      eveningDate.setHours(20, 0, 0, 0);
      
      // Only add if in the future
      if (morningDate > now) {
        const weekNum = Math.floor((morningDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
        dates.push({
          id: `wednesday-nudge-${morningDate.getFullYear()}-W${this.getWeekNumber(morningDate)}-morning`,
          date: morningDate,
          isEvening: false,
        });
      }
      
      if (eveningDate > now) {
        const weekNum = Math.floor((eveningDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
        dates.push({
          id: `wednesday-nudge-${eveningDate.getFullYear()}-W${this.getWeekNumber(eveningDate)}-evening`,
          date: eveningDate,
          isEvening: true,
        });
      }
      
      // Move to next week
      checkDate.setDate(checkDate.getDate() + 7);
    }
    
    return dates;
  }

  /**
   * Helper to get week number for a date
   */
  private static getWeekNumber(date: Date): string {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const weekNumber = Math.ceil((dayOfYear - (7 - startOfYear.getDay())) / 7);
    return weekNumber.toString().padStart(2, '0');
  }

  /**
   * Schedule weekly nudges
   */
  static async scheduleWeeklyNudges(): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if notifications are enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', user.id)
        .single();
      
      if (!profile?.notifications_enabled) {
        console.log('Notifications disabled for user');
        return;
      }

      // Cancel all existing notifications first
      await this.clearAllNotifications();

      // Check if user has posted this week
      const hasPosted = await this.hasPostedThisWeek(user.id);
      
      // Get Wednesday dates to schedule
      const wednesdayDates = this.getNextWednesdayDates();
      const scheduledIds: string[] = [];

      for (const { id, date, isEvening } of wednesdayDates) {
        // Skip current week if user has already posted
        const isCurrentWeek = this.getCurrentISOWeek() === `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
        if (isCurrentWeek && hasPosted) {
          continue;
        }

        // Schedule notification
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: 'Wednesday Waffle',
            body: isEvening ? EVENING_MESSAGE : MORNING_MESSAGE,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: false,
            year: date.getFullYear(),
            month: date.getMonth() + 1, // JavaScript months are 0-indexed
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: 0,
          },
        });
        
        scheduledIds.push(id);
        console.log(`Scheduled notification: ${id} for ${date.toLocaleString()}`);
      }

      // Store scheduled IDs
      await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(scheduledIds));
      console.log(`Scheduled ${scheduledIds.length} Wednesday nudges`);
    } catch (error) {
      console.error('Error scheduling weekly nudges:', error);
    }
  }

  /**
   * Cancel current week's nudges (called after posting)
   */
  static async cancelCurrentWeekNudges(): Promise<void> {
    try {
      const currentWeek = this.getCurrentISOWeek();
      const storedIds = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
      
      if (!storedIds) return;
      
      const notificationIds: string[] = JSON.parse(storedIds);
      const currentWeekIds = notificationIds.filter(id => id.includes(currentWeek));
      
      // Cancel matching notifications
      for (const id of currentWeekIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
        console.log(`Cancelled notification: ${id}`);
      }
      
      // Update stored IDs
      const remainingIds = notificationIds.filter(id => !id.includes(currentWeek));
      await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(remainingIds));
    } catch (error) {
      console.error('Error cancelling current week nudges:', error);
    }
  }

  /**
   * Clear all scheduled notifications
   */
  static async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
      console.log('Cleared all scheduled notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * TEST FUNCTION: Schedule test notifications in the near future
   * Remove this in production!
   */
  static async scheduleTestNotifications(): Promise<void> {
    try {
      // Clear existing notifications first
      await this.clearAllNotifications();

      const now = new Date();
      
      // Schedule notifications 30 seconds and 60 seconds from now
      const testDates = [
        { date: new Date(now.getTime() + 30 * 1000), isEvening: false }, // 30 seconds
        { date: new Date(now.getTime() + 60 * 1000), isEvening: true },  // 60 seconds
      ];

      console.log('📱 Scheduling test notifications:');
      
      for (const { date, isEvening } of testDates) {
        const id = `test-notification-${date.getTime()}`;
        
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: 'Wednesday Waffle (TEST)',
            body: isEvening ? EVENING_MESSAGE : MORNING_MESSAGE,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: false,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds(),
          },
        });
        
        console.log(`✅ Test notification scheduled for ${date.toLocaleTimeString()}`);
      }
      
      console.log('🧪 Test notifications scheduled! You should see them in 30 and 60 seconds.');
    } catch (error) {
      console.error('Error scheduling test notifications:', error);
    }
  }

  /**
   * Update last waffle week in profile (called after posting)
   */
  static async updateLastWaffleWeek(userId: string): Promise<void> {
    try {
      const currentWeek = this.getCurrentISOWeek();
      
      await supabase
        .from('profiles')
        .update({ last_waffle_week: currentWeek })
        .eq('id', userId);
      
      console.log(`Updated last waffle week to ${currentWeek}`);
    } catch (error) {
      console.error('Error updating last waffle week:', error);
    }
  }
} 