import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { X, Play, Pause } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface VideoModalProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}

export default function VideoModal({ visible, videoUrl, onClose }: VideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimer, setControlsTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setShowControls(true);
      startControlsTimer();
    }
    return () => {
      if (controlsTimer) {
        clearTimeout(controlsTimer);
      }
    };
  }, [visible]);

  const startControlsTimer = () => {
    if (controlsTimer) {
      clearTimeout(controlsTimer);
    }
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    setControlsTimer(timer);
  };

  const handleVideoPress = () => {
    setShowControls(true);
    startControlsTimer();
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowControls(true);
    startControlsTimer();
  };

  const handleClose = () => {
    setIsPlaying(true);
    setShowControls(true);
    if (controlsTimer) {
      clearTimeout(controlsTimer);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <TouchableOpacity 
        style={styles.container}
        activeOpacity={1}
        onPress={handleVideoPress}
      >
        <Video
          source={{ uri: videoUrl }}
          style={styles.video}
          shouldPlay={isPlaying}
          isLooping={false}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={false}
        />
        
        {/* Custom Controls Overlay */}
        {showControls && (
          <View style={styles.controlsOverlay}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              {isPlaying ? (
                <Pause size={32} color="#FFFFFF" />
              ) : (
                <Play size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    padding: 8,
  },
  playPauseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
}); 