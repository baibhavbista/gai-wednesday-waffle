import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { RotateCcw, X, Square, Send, Download, ChevronDown } from 'lucide-react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { settingsService } from '@/lib/settings-service';
import { useMedia } from '@/hooks/useMedia';

const { width, height } = Dimensions.get('window');

const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [retentionType, setRetentionType] = useState<'view-once' | '7-day' | 'keep-forever'>('7-day');
  
  // Video preview states
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const { groups, addMessage, currentUser, currentGroupId, isLoading } = useWaffleStore();
  const { uploadMedia, isLoading: isUploading, uploadProgress } = useMedia();
  const router = useRouter();
  const params = useLocalSearchParams();
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Video player setup
  const player = useVideoPlayer(videoUri || '', (player) => {
    player.loop = true;
    // Don't auto-play here, we'll control it manually
  });

  // Get the source group ID from params (if navigated from a specific group)
  const sourceGroupId = params.groupId as string;

  // Initialize selected group - only set if we came from a specific group
  useEffect(() => {
    if (sourceGroupId) {
      setSelectedGroupId(sourceGroupId);
    }
    // Don't set currentGroupId as default - we want null when coming from bottom nav
  }, [sourceGroupId]);

  // Load default retention type from settings
  useEffect(() => {
    const loadDefaultRetentionType = async () => {
      try {
        const defaultType = await settingsService.getDefaultRetentionType();
        setRetentionType(defaultType);
        if (__DEV__) console.log('📱 Loaded default retention type:', defaultType);
      } catch (error) {
        if (__DEV__) console.error('❌ Failed to load default retention type:', error);
      }
    };

    loadDefaultRetentionType();
  }, []);

  // Handle screen focus/blur to manage video playback
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      if (showVideoPreview && player && videoUri) {
        player.play();
      }

      return () => {
        // Screen is losing focus - stop video playback
        if (player && showVideoPreview) {
          try {
            player.replace(''); // Stop playback by replacing with empty source
          } catch (error) {
            console.log('Error stopping video on focus loss:', error);
          }
        }
      };
    }, [showVideoPreview, player, videoUri])
  );

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (player && showVideoPreview) {
        try {
          player.replace(''); // Stop playback
        } catch (error) {
          console.log('Error stopping video on unmount:', error);
        }
      }
    };
  }, [player, showVideoPreview]);

  // Handle video preview state changes
  useEffect(() => {
    if (showVideoPreview && player && videoUri) {
      player.play();
    } else if (player) {
      try {
        player.replace(''); // Stop playback
      } catch (error) {
        console.log('Error stopping video:', error);
      }
    }
  }, [showVideoPreview, player, videoUri]);

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      console.log('Starting recording...');
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 5 minutes
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);

      // Start actual video recording
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_TIME,
        maxFileSize: 50 * 1024 * 1024, // 50MB limit
        // need to specify this since we're passing videoBitrate to CameraView
        codec: "hvc1", // hvc1 is the codec recommended by chatgpt. Also good to later convert this into audio for whisper transcription
      });

      console.log('Recording completed, video:', video);
      
      // This will be called when recording stops (either manually or by timeout)
      if (video && video.uri) {
        setVideoUri(video.uri);
        setShowVideoPreview(true);
      }
      
      // Clean up recording state
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
    } catch (error) {
      console.error('Error during recording:', error);
      
      // Reset states on error
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      // Only show error if it's not a cancellation
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('stopped')) {
        Alert.alert('Error', 'Failed to record video');
      }
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecording) return;

    console.log('Stop recording button pressed');
    
    // Clear the timer immediately
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    // Stop the recording - this will cause the recordAsync promise to resolve
    cameraRef.current.stopRecording();
    
    console.log('Stop recording called on camera');
  };

  const retakeVideo = () => {
    // Stop video playback and cleanup
    if (player) {
      try {
        player.replace(''); // Stop playback
      } catch (error) {
        console.log('Error stopping video on retake:', error);
      }
    }
    
    // Reset video states
    setShowVideoPreview(false);
    setVideoUri(null);
  };

  const downloadVideo = async () => {
    if (!videoUri) return;
    
    // Check if we're on web platform
    if (Platform.OS === 'web') {
      Alert.alert(
        'Download Not Available', 
        'Video download is not supported on web. This feature works on iOS and Android devices.'
      );
      return;
    }
    
    try {
      setIsDownloading(true);
      
      // Request media library permissions if not granted
      if (!mediaLibraryPermission?.granted) {
        const permissionResult = await requestMediaLibraryPermission();
        if (!permissionResult.granted) {
          Alert.alert(
            'Permission Required', 
            'We need permission to save videos to your photo library.'
          );
          setIsDownloading(false);
          return;
        }
      }
      
      // Save video to device gallery
      const asset = await MediaLibrary.createAssetAsync(videoUri);
      
      // Optionally, you can also create an album and add the video to it
      const album = await MediaLibrary.getAlbumAsync('Wednesday Waffle');
      if (album == null) {
        await MediaLibrary.createAlbumAsync('Wednesday Waffle', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
      
      Alert.alert(
        'Success! 🎉', 
        'Video has been saved to your photo library and added to the "Wednesday Waffle" album.'
      );
      
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert(
        'Download Failed', 
        'There was an error saving the video to your device. Please try again.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const sendVideo = async () => {
    if (!currentUser || !videoUri) return;

    console.log('🧇 === WAFFLE CREATION START ===');
    console.log('📹 Video URI:', videoUri);
    console.log('👤 Current User:', currentUser.name);
    console.log('📊 Current Retention Type:', retentionType);
    console.log('🎯 Selected Group ID:', selectedGroupId);
    console.log('📄 Display Text:', getRetentionDisplayText());

    // Stop video playback before navigating
    if (player) {
      try {
        player.replace(''); // Stop playback
      } catch (error) {
        console.log('Error stopping video before send:', error);
      }
    }

    // If no group is selected (came from bottom nav), navigate to group selection
    if (!selectedGroupId) {
      console.log('🔀 No group selected, navigating to group selection with videoUri:', videoUri);
      console.log('🔀 Passing retention type to group selection:', retentionType);
      
      // Note: For group selection flow, we pass the local videoUri and let the group selection 
      // screen handle the upload when groups are selected. This avoids uploading before knowing 
      // which groups the user wants to send to.
      router.push({
        pathname: '/group-selection',
        params: { 
          videoUri,
          retentionType // Also pass retention type to group selection
        }
      });
      return;
    }

    // If we have a selected group, upload video first then send
    try {
      console.log('📤 Starting video upload...');
      
      // Upload the video to storage
      const uploadResult = await uploadMedia(
        { uri: videoUri, type: 'video' },
        'video'
      );

      if (!uploadResult.success) {
        console.error('❌ Video upload failed:', uploadResult.error);
        Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload video');
        return;
      }

      console.log('✅ Video uploaded successfully:', uploadResult.url);

      const messageData = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        content: {
          type: 'video' as const,
          url: uploadResult.url, // ✅ Use uploaded URL instead of local file path
        },
        caption: 'Check out my waffle! 🧇',
        retentionType: retentionType,
        groupId: selectedGroupId,
      };

      console.log('📝 Message data being sent to addMessage:');
      console.log('   - userId:', messageData.userId);
      console.log('   - userName:', messageData.userName);
      console.log('   - content.type:', messageData.content.type);
      console.log('   - content.url:', messageData.content.url ? 'present' : 'missing');
      console.log('   - caption:', messageData.caption);
      console.log('   - retentionType:', messageData.retentionType);
      console.log('   - groupId:', messageData.groupId);

      // Post the waffle
      await addMessage(messageData);

      console.log('✅ Waffle creation completed successfully');
      console.log('🧇 === WAFFLE CREATION END ===');

      Alert.alert('Success!', 'Your waffle has been shared with the group 🧇');
      handleClose();
    } catch (error) {
      console.error('❌ Waffle creation failed:', error);
      console.log('🧇 === WAFFLE CREATION FAILED ===');
      const errorMessage = error instanceof Error ? error.message : 'Failed to send video';
      Alert.alert('Error', errorMessage);
    }
  };

  if (!permission || !microphonePermission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted || !microphonePermission.granted) {
    const needsCamera = !permission.granted;
    const needsMicrophone = !microphonePermission.granted;
    
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need your permission to {needsCamera && needsMicrophone ? 'access the camera and microphone' : 
          needsCamera ? 'show the camera' : 'access the microphone'}
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={() => {
            if (needsCamera) requestPermission();
            if (needsMicrophone) requestMicrophonePermission();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const cycleRetentionType = async () => {
    setRetentionType(current => {
      const newType = (() => {
        switch (current) {
          case 'view-once':
            return '7-day';
          case '7-day':
            return 'keep-forever';
          case 'keep-forever':
            return 'view-once';
          default:
            return '7-day';
        }
      })();

      // Save the new default to settings
      settingsService.setDefaultRetentionType(newType).then(success => {
        if (__DEV__) {
          if (success) {
            console.log('💾 Saved default retention type:', newType);
          } else {
            console.error('❌ Failed to save default retention type');
          }
        }
      });

      return newType;
    });
  };

  const getRetentionDisplayText = () => {
    switch (retentionType) {
      case 'view-once':
        return '1';
      case '7-day':
        return '7d';
      case 'keep-forever':
        return '∞';
      default:
        return '7d';
    }
  };

  const handleClose = () => {
    // Stop video playback before navigating
    if (player && showVideoPreview) {
      try {
        player.replace(''); // Stop playback
      } catch (error) {
        console.log('Error stopping video on close:', error);
      }
    }

    // If we came from a specific group, go back to that group
    if (sourceGroupId) {
      router.push(`/chat/${sourceGroupId}`);
    } 
    // Otherwise, go to the main chats page
    else {
      router.push('/(tabs)');
    }
  };

  // Format recording time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // If showing video preview, render video player instead of camera
  if (showVideoPreview && videoUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.videoPreviewContainer}>
          {/* Video Player */}
          <VideoView
            style={styles.videoPlayer}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />

          {/* Video Preview Header */}
          <View style={styles.videoPreviewHeader}>
            <TouchableOpacity style={styles.controlButton} onPress={retakeVideo}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.videoPreviewTitle}>
              <Text style={styles.videoPreviewText}>Video Preview</Text>
              {selectedGroup && (
                <Text style={styles.videoPreviewSubtext}>
                  Sending to: {selectedGroup.name}
                </Text>
              )}
              {!selectedGroupId && (
                <Text style={styles.videoPreviewSubtext}>
                  Choose groups to send to
                </Text>
              )}
            </View>

            {/* Empty view to maintain spacing */}
            <View style={styles.controlButton} />
          </View>

          {/* Video Preview Controls */}
          <View style={styles.videoPreviewControls}>
            <TouchableOpacity 
              style={[
                styles.downloadButton,
                isDownloading && styles.downloadButtonDisabled
              ]}
              onPress={downloadVideo}
              disabled={isDownloading}
            >
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>
                {isDownloading ? 'Saving...' : 'Download'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.sendButton,
                (isUploading || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={sendVideo}
              disabled={isUploading || isLoading}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>
                {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` :
                 isLoading ? 'Sending...' :
                 selectedGroupId ? 'Send' : 'Choose Groups'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView 
        ref={cameraRef}
        style={styles.camera} 
        facing={facing}
        mode="video"
        videoQuality="720p"
        mirror={facing === 'front' ? true : false}
        onMountError={(error) => {
          console.error('Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera. Please try again.');
        }}
        videoBitrate={2000000} // 2Mbps for okay-ish quality?

      >
        {/* Header Controls */}
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Group Selector - only show if we came from a specific group */}
          {sourceGroupId && selectedGroup && (
            <TouchableOpacity 
              style={styles.groupSelector}
              onPress={() => setShowGroupDropdown(!showGroupDropdown)}
            >
              <Text style={styles.groupSelectorText}>{selectedGroup.name}</Text>
              <ChevronDown size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Show indicator when no group is selected
          {!sourceGroupId && (
            <View style={styles.noGroupIndicator}>
              <Text style={styles.noGroupText}>Choose groups after recording</Text>
            </View>
          )} */}

          <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
            <RotateCcw size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Retention Type Selector */}
        <View style={styles.retentionContainer}>
          <TouchableOpacity style={styles.retentionButton} onPress={cycleRetentionType}>
            <Text style={styles.retentionButtonText}>{getRetentionDisplayText()}</Text>
          </TouchableOpacity>
        </View>

        {/* Group Dropdown */}
        {showGroupDropdown && (
          <View style={styles.groupDropdown}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.groupDropdownOption,
                  selectedGroupId === group.id && styles.groupDropdownOptionActive
                ]}
                onPress={() => {
                  setSelectedGroupId(group.id);
                  setShowGroupDropdown(false);
                }}
              >
                <View style={styles.groupAvatarSmall}>
                  <Text style={styles.groupAvatarTextSmall}>
                    {group.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <Text style={[
                  styles.groupDropdownText,
                  selectedGroupId === group.id && styles.groupDropdownTextActive
                ]}>
                  {group.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recording Timer */}
        {isRecording && (
          <View style={styles.recordingTimer}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {formatTime(recordingTime)}
            </Text>
          </View>
        )}

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {isRecording ? (
            // Stop button when recording
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={stopRecording}
            >
              <Square size={24} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            // Red record button when not recording
            <TouchableOpacity 
              style={styles.recordButton}
              onPress={startRecording}
            >
              <View style={styles.recordButtonInner} />
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retentionContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    alignItems: 'center',
  },
  retentionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retentionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: width * 0.5,
  },
  groupSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginRight: 8,
  },
  noGroupIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: width * 0.6,
  },
  noGroupText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  groupDropdown: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 8,
    zIndex: 1000,
    maxHeight: 300,
  },
  groupDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  groupDropdownOptionActive: {
    backgroundColor: '#F97316',
  },
  groupAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupAvatarTextSmall: {
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  groupDropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    flex: 1,
  },
  groupDropdownTextActive: {
    color: '#FFFFFF',
  },
  recordingTimer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginHorizontal: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Video Preview Styles
  videoPreviewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoPreviewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoPreviewTitle: {
    flex: 1,
    alignItems: 'center',
  },
  videoPreviewText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },
  videoPreviewSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  videoPreviewControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  downloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  sendButton: {
    backgroundColor: '#F97316',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
});