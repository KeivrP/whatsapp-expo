import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, FlatList, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BluetoothSerial from 'react-native-bluetooth-serial';

interface Message {
  id: string;
  text: string;
  sender: 'Me' | 'Other';
  timestamp: number;
}

interface BluetoothDevice {
  id: string;
  name: string;
}

// Helper function to generate truly unique IDs
const generateUniqueId = (): string => {
  return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
};

export default function App() {
  const [deviceName, setDeviceName] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const dataListenerRef = useRef<{ remove: () => void } | null>(null);
  const messagesEndRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    // Inicializar Bluetooth al iniciar
    const initializeBluetooth = async () => {
      try {
        await BluetoothSerial.requestEnable();
        const enabled = await BluetoothSerial.isEnabled();
        setIsBluetoothEnabled(enabled);
        
        if (enabled) {
          const deviceList = await BluetoothSerial.list();
          setDeviceName('ChatBT');
          setMacAddress('');
          
          // Configurar la escucha de datos entrantes
          const dataListener = BluetoothSerial.on('data', (data) => {
            if (data === '__HEARTBEAT__') {
              BluetoothSerial.write('__HEARTBEAT_ACK__');
              return;
            }
            if (inactivityTimerRef.current) {
              clearTimeout(inactivityTimerRef.current);
            }
            inactivityTimerRef.current = setTimeout(() => {
              disconnectPeer();
            }, 30000); // 30 segundos timeout
            
            // Usar el nuevo generador de IDs
            const newMessage: Message = {
              id: generateUniqueId(),
              text: data,
              sender: 'Other',
              timestamp: Date.now()
            };
            
            setMessages(prevMessages => {
    const isDuplicate = prevMessages.some(msg => 
      msg.text === data && 
      msg.sender === 'Other' && 
      Date.now() - msg.timestamp < 2000
    );
    
    if (isDuplicate) return prevMessages;
    
    return [...prevMessages, {
      id: generateUniqueId(),
      text: data,
      sender: 'Other',
      timestamp: Date.now()
    }];
  });
          });
          dataListenerRef.current = dataListener;
          
          // Obtener dispositivos emparejados
          updatePairedDevices();
        }
      } catch (error) {
        console.log('Error al inicializar Bluetooth:', error);
        Alert.alert('Error', 'No se pudo activar Bluetooth');
      }
    };
    
    initializeBluetooth();
    
    return () => {
      // Limpiar al desmontar
      if (dataListenerRef.current) dataListenerRef.current.remove();
      disconnectPeer();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);
  
  const updatePairedDevices = async () => {
    try {
      const devices = await BluetoothSerial.list();
      setPairedDevices(devices);
    } catch (error) {
      console.log('Error al obtener dispositivos emparejados:', error);
    }
  };
  
  const scanForDevices = async () => {
    try {
      setConnectionStatus('Buscando dispositivos...');
      setShowDeviceList(true);
      
      const devices = await BluetoothSerial.discoverUnpairedDevices();
      setAvailableDevices(devices);
      setConnectionStatus(isConnected ? `Conectado a: ${deviceName}` : 'Listo para conectar');
    } catch (error) {
      console.log('Error al buscar dispositivos:', error);
      setConnectionStatus('Error en búsqueda');
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    if (isConnected) return;
    console.log('Conectando a:', device);
    try {
      setConnectionStatus(`Conectando a ${device.name || device.id}...`);
      console.log('Intentando conectar a:', device);
      // Intentar conectar
      await BluetoothSerial.connect(device.id);
      
      setConnectionStatus(`Conectado a: ${device.name || device.id}`);
      setDeviceName(device.name || 'Dispositivo');
      setMacAddress(device.id);
      setIsConnected(true);
      setShowDeviceList(false);
      
      // Iniciar heartbeat
      intervalRef.current = setInterval(() => {
        if (isConnected) {
          BluetoothSerial.write('__HEARTBEAT__');
        }
      }, 5000);
      
      // Configurar temporizador de inactividad
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        disconnectPeer();
      }, 30000); // 30 segundos
    } catch (error) {
      console.log('Error de conexión:', error);
      setConnectionStatus(`Error: No se pudo conectar`);
      Alert.alert('Error de conexión', `No se pudo conectar al dispositivo: ${device.name || device.id}`);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !isConnected) return;

    try {
      await BluetoothSerial.write(messageText);
      const newMessage: Message = {
        id: generateUniqueId(),
        text: messageText,
        sender: 'Me',
        timestamp: Date.now()
      };
      
      setMessages(prevMessages => {
    const isDuplicate = prevMessages.some(msg => 
      msg.text === data && 
      msg.sender === 'Other' && 
      Date.now() - msg.timestamp < 2000
    );
    
    if (isDuplicate) return prevMessages;
    
    return [...prevMessages, {
      id: generateUniqueId(),
      text: data,
      sender: 'Other',
      timestamp: Date.now()
    }];
  });
      setMessageText('');
      
      // Reiniciar temporizador de inactividad
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        disconnectPeer();
      }, 30000); // 30 segundos
    } catch (error) {
      console.log('Error al enviar mensaje:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const disconnectPeer = async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    try {
      await BluetoothSerial.disconnect();
    } catch (error) {
      console.log('Error al desconectar:', error);
    }
    
    setIsConnected(false);
    setConnectionStatus('Desconectado');
  };

  const toggleBluetooth = async () => {
    try {
      if (isBluetoothEnabled) {
        await BluetoothSerial.disable();
        setIsBluetoothEnabled(false);
        setConnectionStatus('Bluetooth desactivado');
      } else {
        await BluetoothSerial.requestEnable();
        setIsBluetoothEnabled(true);
        setConnectionStatus('Bluetooth activado');
        updatePairedDevices();
      }
    } catch (error) {
      console.log('Error al cambiar estado de Bluetooth:', error);
    }
  };

  const renderDeviceItem = ({ item }: { item: BluetoothDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
    >
      <View>
        <Text style={styles.deviceName}>{item.name || 'Dispositivo desconocido'}</Text>
        <Text style={styles.deviceAddress}>{item.id}</Text>
      </View>
      <Ionicons name="bluetooth" size={20} color="#0f065a" />
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.sender === 'Me' ? styles.sentMessage : styles.receivedMessage
    ]}>
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f065a" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{deviceName || 'ChatBT'}</Text>
        <Text style={styles.headerSubtitle}>{macAddress}</Text>
        <Text style={[styles.headerSubtitle, styles.connectionStatus]}>{connectionStatus}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.connectionContainer}>
          <TouchableOpacity
            style={[styles.button, isBluetoothEnabled ? styles.connectButton : styles.disconnectButton]}
            onPress={toggleBluetooth}
          >
            <Text style={styles.buttonText}>
              {isBluetoothEnabled ? 'Bluetooth ON' : 'Bluetooth OFF'}
            </Text>
          </TouchableOpacity>
          
          {isBluetoothEnabled && (
            <>
              {isConnected ? (
                <TouchableOpacity
                  style={[styles.button, styles.disconnectButton]}
                  onPress={disconnectPeer}
                >
                  <Text style={styles.buttonText}>Desconectar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.connectButton]}
                  onPress={scanForDevices}
                >
                  <Text style={styles.buttonText}>Buscar dispositivos</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {showDeviceList && !isConnected && (
          <View style={styles.deviceListContainer}>
            <Text style={styles.deviceListTitle}>Dispositivos emparejados</Text>
            <FlatList
              data={pairedDevices}
              keyExtractor={(item) => item.id}
              renderItem={renderDeviceItem}
              ListEmptyComponent={<Text style={styles.emptyListText}>No hay dispositivos emparejados</Text>}
              style={styles.deviceList}
            />
            
            <Text style={styles.deviceListTitle}>Dispositivos disponibles</Text>
            <FlatList
              data={availableDevices}
              keyExtractor={(item) => item.id}
              renderItem={renderDeviceItem}
              ListEmptyComponent={<Text style={styles.emptyListText}>No se encontraron dispositivos</Text>}
              style={styles.deviceList}
            />
          </View>
        )}

        {!showDeviceList && (
          <FlatList
            ref={messagesEndRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContainer}
  extraData={messages.length}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Escribe un mensaje..."
            value={messageText}
            onChangeText={setMessageText}
            editable={isConnected}
          />
          <TouchableOpacity
            style={[
              styles.button, 
              styles.sendButton,
              !isConnected && styles.disabledButton
            ]}
            onPress={sendMessage}
            disabled={!isConnected}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#0f065a',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  connectionStatus: {
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: '#E7EDF3',
  },
  connectionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  deviceListContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  deviceListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f065a',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  deviceList: {
    maxHeight: 150,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#95A5A6',
  },
  emptyListText: {
    padding: 16,
    textAlign: 'center',
    color: '#95A5A6',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  connectButton: {
    backgroundColor: '#0f065a',
  },
  disconnectButton: {
    backgroundColor: '#95A5A6',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendButton: {
    backgroundColor: '#0f065a',
    borderRadius: 24,
    width: 48,
    height: 48,
    padding: 0,
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  messagesContainer: {
    flexGrow: 1,
    gap: 8,
    paddingVertical: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#2C3E50',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: '#95A5A6',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
  },
});