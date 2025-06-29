import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Bell, Shield, CircleHelp as HelpCircle, LogOut, ChevronRight, User, Camera } from 'lucide-react-native';
import { wafflesService } from '@/lib/database-service';

export default function ProfileScreen() {
  const { currentUser, groups, isLoading } = useWaffleStore();
  const { signOut, isReady } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [totalWaffles, setTotalWaffles] = useState<number | null>(null);

  // Fetch total waffles shared by the user
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (currentUser) {
        try {
          const count = await wafflesService.countForUser(currentUser.id);
          if (mounted) setTotalWaffles(count);
        } catch (err) {
          console.error('Error fetching waffle count:', err);
          if (mounted) setTotalWaffles(0);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  // Calculate unique friends across all groups (exclude duplicates and current user)
  const uniqueFriendIds = React.useMemo(() => {
    const ids = new Set<string>();
    groups.forEach((group) => {
      group.members.forEach((member) => {
        if (member.id !== currentUser?.id) {
          ids.add(member.id);
        }
      });
    });
    return ids;
  }, [groups, currentUser]);
  const totalMembers = uniqueFriendIds.size;

  const settingsOptions = [
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Wednesday nudges and group activity',
      rightComponent: (
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
          thumbColor={notificationsEnabled ? '#F97316' : '#9CA3AF'}
        />
      ),
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      subtitle: 'FAQs, contact us, and feedback',
      rightComponent: <ChevronRight size={20} color="#9CA3AF" />,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}` }} 
              style={styles.avatar} 
            />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Camera size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.userName}>{currentUser?.name || 'Loading...'}</Text>
          <Text style={styles.userEmail}>{currentUser?.email || 'Loading...'}</Text>
          
          <TouchableOpacity style={styles.editProfileButton}>
            <User size={16} color="#F97316" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoading ? '-' : groups.length}
            </Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoading ? '-' : totalWaffles}
            </Text>
            <Text style={styles.statLabel}>Waffles Shared</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoading ? '-' : totalMembers}
            </Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {settingsOptions.map((option, index) => (
            <TouchableOpacity key={index} style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <option.icon size={20} color="#F97316" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{option.title}</Text>
                  <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
                </View>
              </View>
              {option.rightComponent}
            </TouchableOpacity>
          ))}
        </View>

        {/* About */}
        <View style={styles.aboutContainer}>
          <Text style={styles.sectionTitle}>About Wednesday Waffle</Text>
          <Text style={styles.aboutText}>
            Stay connected with your closest friends through weekly life updates. 
            No pressure, no performance—just authentic moments shared with the people who matter most.
          </Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity 
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]} 
          onPress={async () => {
            try {
              setSigningOut(true);
              const { error } = await signOut();
              if (error) {
                console.error('Sign out error:', error);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            } catch (error) {
              console.error('Sign out exception:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setSigningOut(false);
            }
          }}
          disabled={signingOut}
        >
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginBottom: 20,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7ED',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editProfileText: {
    color: '#F97316',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginLeft: 6,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingVertical: 24,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  settingsContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  aboutContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  aboutText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginBottom: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: '#EF4444',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
});