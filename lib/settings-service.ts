import AsyncStorage from '@react-native-async-storage/async-storage';

// Settings interface defining all app settings
export interface AppSettings {
  defaultRetentionType: 'view-once' | '7-day' | 'keep-forever';
  notificationEnabled: boolean;
  notificationTimes: {
    morning: string; // "09:00"
    evening: string; // "20:00"
  };
  cameraQuality: '720p' | '1080p';
  lastSelectedGroupId: string | null;
  onboardingCompleted: boolean;
  autoDownloadMedia: boolean;
  themeDarkMode: boolean;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  defaultRetentionType: '7-day',
  notificationEnabled: true,
  notificationTimes: {
    morning: '09:00',
    evening: '20:00',
  },
  cameraQuality: '720p',
  lastSelectedGroupId: null,
  onboardingCompleted: false,
  autoDownloadMedia: true,
  themeDarkMode: false,
};

const SETTINGS_KEY = '@wednesday_waffle_settings';

class SettingsService {
  private cachedSettings: AppSettings | null = null;

  // Load all settings from storage
  async loadSettings(): Promise<AppSettings> {
    try {
      if (this.cachedSettings) {
        return this.cachedSettings;
      }

      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      let settings: AppSettings;
      
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Merge with defaults to ensure new settings are included
        settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
      } else {
        settings = { ...DEFAULT_SETTINGS };
      }

      this.cachedSettings = settings;
      if (__DEV__) console.log('📱 Settings loaded:', this.cachedSettings);
      return settings;
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to load settings:', error);
      const fallbackSettings = { ...DEFAULT_SETTINGS };
      this.cachedSettings = fallbackSettings;
      return fallbackSettings;
    }
  }

  // Save all settings to storage
  async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      this.cachedSettings = settings;
      if (__DEV__) console.log('💾 Settings saved:', settings);
      return true;
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to save settings:', error);
      return false;
    }
  }

  // Update specific setting
  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<boolean> {
    try {
      const currentSettings = await this.loadSettings();
      const updatedSettings = { ...currentSettings, [key]: value };
      return await this.saveSettings(updatedSettings);
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to update setting:', error);
      return false;
    }
  }

  // Get specific setting
  async getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const settings = await this.loadSettings();
    return settings[key];
  }

  // Reset to defaults
  async resetSettings(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      this.cachedSettings = null;
      if (__DEV__) console.log('🔄 Settings reset to defaults');
      return true;
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to reset settings:', error);
      return false;
    }
  }

  // Clear cache (useful for testing or forced refresh)
  clearCache(): void {
    this.cachedSettings = null;
  }

  // Convenience methods for common settings
  async getDefaultRetentionType(): Promise<'view-once' | '7-day' | 'keep-forever'> {
    return await this.getSetting('defaultRetentionType');
  }

  async setDefaultRetentionType(type: 'view-once' | '7-day' | 'keep-forever'): Promise<boolean> {
    return await this.updateSetting('defaultRetentionType', type);
  }

  async getNotificationSettings(): Promise<{ enabled: boolean; times: { morning: string; evening: string } }> {
    const settings = await this.loadSettings();
    return {
      enabled: settings.notificationEnabled,
      times: settings.notificationTimes,
    };
  }

  async setNotificationEnabled(enabled: boolean): Promise<boolean> {
    return await this.updateSetting('notificationEnabled', enabled);
  }

  async setNotificationTimes(morning: string, evening: string): Promise<boolean> {
    return await this.updateSetting('notificationTimes', { morning, evening });
  }

  async getLastSelectedGroupId(): Promise<string | null> {
    return await this.getSetting('lastSelectedGroupId');
  }

  async setLastSelectedGroupId(groupId: string | null): Promise<boolean> {
    return await this.updateSetting('lastSelectedGroupId', groupId);
  }

  async isOnboardingCompleted(): Promise<boolean> {
    return await this.getSetting('onboardingCompleted');
  }

  async markOnboardingCompleted(): Promise<boolean> {
    return await this.updateSetting('onboardingCompleted', true);
  }
}

export const settingsService = new SettingsService(); 