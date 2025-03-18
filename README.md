# Chat TCP - Documentación

Esta aplicación es un chat TCP que permite la comunicación directa entre dos dispositivos a través de una conexión TCP/IP.

## Funciones Principales

### Inicialización y Configuración

#### `initializeDevice()`
Función asíncrona que se ejecuta al iniciar la aplicación. Obtiene la dirección IP del dispositivo y configura el nombre del chat.

#### `startServer(ip: string)`
Inicia el servidor TCP en el puerto 5050:
- Escucha conexiones entrantes
- Maneja mensajes recibidos
- Procesa heartbeats para mantener la conexión activa
- Configura el timeout por inactividad

### Gestión de Conexiones

#### `connectToPeer()`
Establece una conexión con otro dispositivo:
- Crea un socket cliente TCP
- Configura el timeout de conexión a 5 segundos
- Implementa el sistema de heartbeat
- Actualiza el historial de IPs conectadas
- Maneja errores de conexión

#### `disconnectPeer()`
Gestiona la desconexión del chat:
- Limpia el temporizador de inactividad
- Destruye la conexión del socket
- Reinicia el estado de la conexión
- Limpia los mensajes

### Sistema de Mensajería

#### `sendMessage()`
Gestiona el envío de mensajes:
- Verifica que el mensaje no esté vacío
- Comprueba que exista una conexión activa
- Envía el mensaje a través del socket
- Actualiza la interfaz con el mensaje enviado

### Características de Seguridad

#### Sistema de Heartbeat
- Envía señales cada 5 segundos para verificar la conexión
- Previene desconexiones por inactividad
- Mantiene la conexión TCP activa

#### Timeout por Inactividad
- Desconecta automáticamente después de 30 segundos sin actividad
- Previene conexiones zombies
- Libera recursos del sistema

### Interfaz de Usuario

#### Componentes Principales
- Cabecera con información del dispositivo y estado de conexión
- Campo de entrada para IP del dispositivo destino
- Historial de IPs conectadas previamente
- Lista de mensajes con diseño de burbujas
- Campo de entrada para mensajes
- Botones de conexión/desconexión

#### Características de la UI
- Diseño responsive
- Indicadores de estado de conexión
- Diferenciación visual entre mensajes enviados y recibidos
- Soporte para múltiples líneas en mensajes
- Historial de IPs para conexiones rápidas

## Consideraciones Técnicas

- Puerto TCP: 5050
- Timeout de conexión: 5 segundos
- Intervalo de heartbeat: 5 segundos
- Timeout por inactividad: 30 segundos
- Soporte para iOS y Android
- Manejo de errores de red
- Gestión de estado de conexión