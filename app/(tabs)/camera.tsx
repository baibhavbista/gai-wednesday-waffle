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
  TextInput,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Audio, InterruptionModeIOS } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import { RotateCcw, X, Square, Send, Download, ChevronDown } from 'lucide-react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { settingsService } from '@/lib/settings-service';
import { useMedia } from '@/hooks/useMedia';
import { getVideoChunk } from '@/lib/media-processing';
import { getCaptionSuggestions, getCaptionSuggestionsFromAudio, getConversationStarters } from '@/lib/ai-service';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

const recordingOptions = {
  // for Android, create an m4a
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  // for iOS, create an m4a (or change to .wav + LINEARPCM if you prefer)
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  // add for web too. FIXME: unsure if these are good
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  
  // Video preview states
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Caption Genie states
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);

  // Audio recording states
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const captionTriggeredRef = useRef(false);

  // Prompt-Me-Please states
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [showStarterOverlay, setShowStarterOverlay] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Configure audio session for dual recording
  useEffect(() => {
    const setupAudio = async () => {
      try {
        if (__DEV__) console.log('🎤 Setting up audio mode for dual recording...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        });
        if (__DEV__) console.log('✅ Audio mode setup complete.');
      } catch (error) {
        if (__DEV__) console.error('❌ Failed to set audio mode:', error);
        Alert.alert('Audio Error', 'Could not configure audio recording. Caption suggestions might be slower.');
      }
    };
    setupAudio();
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
      // Trigger caption generation when preview appears
      generateCaptionsFromVideo();
    } else if (player) {
      try {
        player.replace(''); // Stop playback
      } catch (error) {
        console.log('Error stopping video:', error);
      }
    }
  }, [showVideoPreview, player, videoUri]);

  // Idle timer to trigger Prompt-Me-Please suggestions
  useEffect(() => {
    // Helper to clear existing timer
    const clearExisting = () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };

    // If user is recording or previewing, stop the idle timer and hide overlay
    if (isRecording || showVideoPreview) {
      clearExisting();
      setShowStarterOverlay(false);
      return;
    }

    // Only start timer when camera is idle and a group is selected
    if (!isRecording && !showVideoPreview && selectedGroupId && currentUser) {
      clearExisting();
      idleTimer.current = setTimeout(async () => {
        try {
          const prompts = await getConversationStarters(selectedGroupId, currentUser.id);
          if (prompts.length) {
            setStarterPrompts(prompts);
            setShowStarterOverlay(true);
          }
        } catch (err) {
          console.log('Prompt-Me-Please error:', err);
        }
      }, 10000); // 10 seconds idle
    }

    // Cleanup when dependencies change
    return () => {
      clearExisting();
    };
  }, [isRecording, showVideoPreview, selectedGroupId, currentUser]);

  const triggerFastCaptions = async (newAudioRecording: Audio.Recording) => {
    let audioRecording = newAudioRecording;
    if (!audioRecording) {
      console.log('🎤 Audio recording not found, cannot trigger fast captions.');
      return;
    }

    console.log('🎤 Stopping audio recording to get fast captions...');
    setIsGeneratingCaptions(true);
    setCaptionError(null);
    captionTriggeredRef.current = true; // Mark as triggered

    try {
      await audioRecording.stopAndUnloadAsync();
      const audioUri = audioRecording.getURI();
      if (!audioUri) {
        throw new Error('Could not get audio recording URI.');
      }

      // Debug: Log the audio file details
      console.log(`🎤 Audio recorded, URI: ${audioUri}`);
      
      // Check if the file exists and get its info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 Audio File Info:', {
        exists: fileInfo.exists,
        size: fileInfo.exists && 'size' in fileInfo ? `${(fileInfo.size / 1024).toFixed(2)} KB` : 'unknown',
        uri: fileInfo.uri
      });

      // Read the first few bytes to check the file header
      const header = await FileSystem.readAsStringAsync(audioUri, {
        length: 32,  // Read first 32 bytes
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('🔍 File Header (Base64):', header);

      // Get file extension from URI
      const extension = audioUri.split('.').pop()?.toLowerCase();
      console.log('📝 File Extension:', extension);

      const styleCaptions = ['Just another manic monday', 'spilling the tea', 'weekly recap'];
      const suggestions = await getCaptionSuggestionsFromAudio(audioUri, styleCaptions);
      setCaptionSuggestions(suggestions);
      console.log('✅ Fast captions generated successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate captions from audio.';
      setCaptionError(errorMessage);
      console.error('Error generating fast captions:', errorMessage);
      // Fallback to video method if audio fails
      captionTriggeredRef.current = false;
    } finally {
      setIsGeneratingCaptions(false);
      setAudioRecording(null);
    }
  };

  const generateCaptionsFromVideo = async () => {
    if (!videoUri || captionTriggeredRef.current) {
      if (captionTriggeredRef.current) console.log('📸 Video captions skipped, fast captions already triggered.');
      return;
    }

    setIsGeneratingCaptions(true);
    setCaptionError(null);
    setCaptionSuggestions([]);

    try {
      // For now, using hardcoded style examples as per the plan.
      // This could be fetched from user settings in the future.
      const styleCaptions = ['Just another manic monday', 'spilling the tea', 'weekly recap'];

      const videoChunkUri = await getVideoChunk(videoUri);
      const suggestions = await getCaptionSuggestions(videoChunkUri, styleCaptions);

      setCaptionSuggestions(suggestions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate captions.';
      setCaptionError(errorMessage);
      console.error('Error generating captions:', errorMessage);
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      console.log('Starting recording...');
      setIsRecording(true);
      setRecordingTime(0);

      // Also reset caption states
      setCaption('');
      setCaptionSuggestions([]);
      setCaptionError(null);
      captionTriggeredRef.current = false; // Reset caption trigger flag

      // --- Start Audio Recording ---
      console.log('🎤 Starting audio recorder...');
      const newAudioRecording = new Audio.Recording();
      await newAudioRecording.prepareToRecordAsync(recordingOptions);
      await newAudioRecording.startAsync();
      setAudioRecording(newAudioRecording);
      console.log('🎤 Audio recorder started.');

      // Start recording timer
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;

          // After 30s, trigger fast captions if not already done
          if (newTime >= 30 && !captionTriggeredRef.current) {
            console.log('⏰ 30-second mark reached, triggering fast captions...');
            captionTriggeredRef.current = true; // so that this is just called once
            triggerFastCaptions(newAudioRecording);
          }

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
        maxFileSize: 50 * 1024 * 1024, // 50MB limit, enforced by supabase free plan
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

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    console.log('Stop recording button pressed');

    // --- Stop audio recording if it's still running ---
    if (audioRecording) {
      console.log('🎤 Stopping audio recorder from main stop function...');
      try {
        await audioRecording.stopAndUnloadAsync();
        setAudioRecording(null);
        console.log('🎤 Audio recorder stopped and unloaded.');
      } catch (error) {
        console.error('🎤 Error stopping audio recorder:', error);
      }
    }
    
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
    
    // Cleanup audio recording if it exists
    if (audioRecording) {
      console.log('🎤 Cleaning up lingering audio recording on retake...');
      audioRecording.stopAndUnloadAsync().catch(err => console.error('Error unloading audio on retake', err));
      setAudioRecording(null);
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
    console.log('🎯 Selected Group ID:', selectedGroupId);
    console.log('✍️ Caption:', caption);

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
      
      router.push({
        pathname: '/group-selection',
        params: { 
          videoUri,
          caption
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
        caption: caption || 'Check out my waffle! 🧇',
        groupId: selectedGroupId,
      };

      console.log('📝 Message data being sent to addMessage:');
      console.log('   - userId:', messageData.userId);
      console.log('   - userName:', messageData.userName);
      console.log('   - content.type:', messageData.content.type);
      console.log('   - content.url:', messageData.content.url ? 'present' : 'missing');
      console.log('   - caption:', messageData.caption);
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

  if (!cameraPermission || !audioPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !audioPermission.granted) {
    const needsCamera = !cameraPermission.granted;
    const needsMicrophone = !audioPermission.granted;
    
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need your permission to {needsCamera && needsMicrophone ? 'access the camera and microphone' : 
          needsCamera ? 'show the camera' : 'access the microphone'}
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={() => {
            if (needsCamera) requestCameraPermission();
            if (needsMicrophone) requestAudioPermission();
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

          {/* Caption Input and Suggestions */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#9CA3AF"
              value={caption}
              onChangeText={setCaption}
              maxLength={70}
            />
            {isGeneratingCaptions && (
              <Text style={styles.captionStatusText}>🪄 Caption Genie is working...</Text>
            )}
            {captionError && (
              <Text style={styles.captionStatusText}>😕 {captionError}</Text>
            )}
            <View style={styles.suggestionsContainer}>
              {captionSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => setCaption(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
        videoBitrate={1000000} // 2Mbps for okay-ish quality?
      />

      {/* Prompt-Me-Please overlay */}
      {showStarterOverlay && starterPrompts.length > 0 && (
        <View style={styles.promptOverlay}>
          {starterPrompts.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => {
                setCaption(prompt);
                setShowStarterOverlay(false);
              }}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Header Controls - Now an overlay */}
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

        <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
          <RotateCcw size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Group Dropdown - Now an overlay */}
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

      {/* Recording Timer - Now an overlay */}
      {isRecording && (
        <View style={styles.recordingTimer}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            {formatTime(recordingTime)}
          </Text>
        </View>
      )}

      {/* Bottom Controls - Now an overlay */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
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
    top: 140,
    // width just enough to fit the text
    width: 'auto',
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
    backgroundColor: '#FFFFFF',
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
  captionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  captionStatusText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 4,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 12,
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
  promptOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 8,
  },
  promptText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
});