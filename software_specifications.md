# Tienda del aventurero
Aplicación Web para vender NFTs con fines educativos. El título de la web es "Tienda del aventurero". Utilizar un estilo visual como si fuera un videojuego de aventuras de calabozos y dragones.

## Módulos principales
- Pantalla del administrador
- Pantalla de la tienda 

## Base de datos
- La conexión se toma de la variable NEON_DB del archivo .env
- Las tablas se crean automáticamente al iniciar la aplicación si no existen

## Pantalla del administrador
- Solamente se puede acceder a través de la ruta "/admin"
- Para poder entrar pide contraseña
- Sesión del administrador: luego del login se crea una cookie `httpOnly`, `secure` (en producción) y `sameSite=strict`, firmada con la variable SESSION_SECRET del archivo .env, con expiración de 8 horas. La pantalla del administrador debe tener un botón "Cerrar sesión"

El menú de opciones del administrador es:

### Crear colección NFT: 
- Permite crear una colección de NFTs con una interfaz muy simple: el administrador ingresa una descripción general de la colección y agrega de 1 a 5 NFTs; para cada uno únicamente ingresa un nombre o descripción corta de la imagen y sube un archivo `.png` desde su dispositivo (la cantidad a crear/mint por cada NFT es de `30` por defecto). El administrador no tiene que ingresar URLs, CIDs de IPFS ni archivos JSON
- En Hedera Testnet se crea un único token no fungible (`NonFungibleUnique`, un solo `TokenId`) para toda la colección usando valores por defecto (`tokenName`: "Tienda del Aventurero", `tokenSymbol`: "AVENTURA"), guardando la descripción general completa en Neon DB. Los seriales de los tipos de NFT seleccionados se crean (mint) en lotes de máximo 10 seriales por transacción (`TokenMintTransaction`, límite de red de Hedera)
- Internamente y de forma transparente para el usuario, el backend se encarga de cumplir con el límite estricto de 100 bytes del campo `metadata` en Hedera y el estándar HIP-412 requerido por HashPack (funcionando por igual en `localhost` y en producción) utilizando el servicio IPFS de Pinata (`PINATA_JWT` en `.env`) mediante doble registro en IPFS por cada NFT:
  1. **Subida del archivo PNG a IPFS**: el backend recibe el archivo `.png` subido en el formulario y lo publica automáticamente en Pinata para obtener su `ipfs://<image_cid>`
  2. **Subida del JSON de metadata HIP-412 a IPFS**: el backend construye automáticamente el JSON estándar HIP-412 (`name`, `creator`, `description`, `image: "ipfs://<image_cid>"`, `type: "image/png"`) referenciando el `ipfs://<image_cid>` de la imagen y lo publica en Pinata para obtener un segundo CID `ipfs://<metadata_cid>` (~66 bytes, `<= 100 bytes`), el cual se graba como `metadata` en los seriales creados en Hedera Testnet. Para mostrar las imágenes en las pantallas de la web, el sistema resuelve el CID mediante un gateway público HTTPS de IPFS
- Este sistema demostrativo solamente acepta y administra una sola colección activa. En caso ya exista una colección activa almacenada en base de datos, simplemente mostrarla en pantalla indicando la cantidad disponible por asignar de cada NFT, su imagen y un enlace para ver la información del token/colección en el explorador Testnet de Hedera (HashScan)
- Si el administrador quiere crear otra colección NFT tiene que apretar el botón borrar colección de la base de datos y empezar de nuevo; esto simplemente desactiva/borra la colección activa a mostrar en la tienda, no borra registros de compras anteriores
- Esta web es de pruebas, usar datos por defecto para la creación de NFTs cuando sea posible. No es necesario considerar regalías ni parámetros adicionales

### Sorteo
- Lista los NFTs comprados recientemente (incluyendo fecha y hora de compra), usando un listado paginado simple de 50 líneas por página manejado en el lado del cliente
- Tiene un botón llamado "elegir comprador random" que, al ser apretado, muestra una animación por 15 segundos de varios nombres de compradores apareciendo y desapareciendo rápidamente en la pantalla como si fuera una ruleta de concurso. Al final elige uno de los compradores de la lista utilizando una función aleatoria, verificando que los participantes correspondan únicamente a compras de la colección actualmente activa, mostrando su nombre y su número de cuenta Hedera, ambos en letras grandes y con un efecto de confetti a su alrededor
- Si una persona (identificada de forma única por su cuenta de Hedera `0.0.xxxxx` dentro de la colección activa) compró varios NFTs, solamente tiene una oportunidad de ganar en el sorteo. Si no hay compradores en la colección activa, el botón de sorteo permanece deshabilitado. Esta web es solamente para fines educativos

## Pantalla del usuario
- Muestra la colección actual de NFTs disponible para ser adquiridos, indicando también la cantidad disponible de cada NFT
- Cuando el usuario elige un NFT disponible, el flujo de compra sigue este orden para evitar pagos huérfanos:
  1. Primero, la web solicita al usuario completar y validar el siguiente formulario:

  Datos mandatorios
  * nombre
  * apellido
  * email

  Datos no mandatorios
  * Industria, campo de selección con las opciones: Corporativo,Servicios Financieros,Tecnología Financiera,Consultoría,Gobierno y Regulación,Software,Académico,Defensa y Espacio,Otro
  * Intereses, campo de selección con las opciones: Inversionista Institucional / Proveedor de Liquidez,Caso de Uso Empresarial,Hedera Council,dApp,Integrador de Sistemas,Socio de Infraestructura
  * Función Laboral, campo de selección con las opciones: Desarrollo de Negocios / Ventas,Ingeniería,Finanzas,TI / Técnico,Legal / Normativo,Socio,Innovación,Consultor,Otro

  2. Una vez validado el formulario, la web inicia la conexión con la billetera HashPack (usando `@hashgraph/hedera-wallet-connect` / WalletConnect v2) y solicita al usuario firmar y ejecutar la transferencia de 1 HBAR desde su cuenta de Hedera hacia la cuenta administradora de la web (`OPERATOR_ID` en `.env`)
  3. Completada la transferencia de 1 HBAR, el backend verifica la transacción en Hedera Testnet (éxito de la operación, cuenta pagadora y recepción de 1 HBAR en `OPERATOR_ID`) y valida mediante una restricción `UNIQUE` sobre el `transaction_id` en Neon DB que dicho pago no haya sido utilizado antes (protección contra ataques de repetición / replay)
- Verificado el pago, el backend asigna un serial disponible del NFT elegido al comprador utilizando `TokenAirdropTransaction` (HIP-904):
  * Si la cuenta del comprador permite asociación automática, recibe el NFT de inmediato
  * Si la asociación automática no puede completarse (quedando como *Pending Airdrop* en Hedera), la pantalla muestra una notificación clara explicando al usuario los pasos para aceptar/reclamar el NFT pendiente dentro de su billetera HashPack
- Guardar en base de datos la información del comprador junto con el serial asignado y el `transaction_id`
- Reducir en uno la cantidad disponible del NFT comprado

## Características multi idioma
- La aplicación debe guardar en un archivo de texto, fuera del código fuente, todo mensaje que aparece en pantalla, para que luego sea fácil de traducir a otro idioma. Usar el módulo `@nuxtjs/i18n` con el archivo `i18n/locales/es.json`
- El idioma por defecto de la aplicación es el español

## Características técnicas
- Aplicación fullstack javascript utilizando Nuxt versión 4.6 o superior y Vue versión 3.5 o superior, ejecutándose sobre Node.js `24.22.3` (incluir archivo `.nvmrc` con `24.22.3` y campo `engines` en `package.json`). El backend se implementa con las rutas de servidor de Nuxt (`server/api`)
- La aplicación será instalada en el servicio de alojamiento de aplicaciones Railway, usando el plan Hobby. En Railway las variables de entorno no se leen del archivo .env, sino que se configuran en el panel de variables del servicio
- La aplicación puede crear las tablas que necesite para guardar su propia información, en la base de datos Neon DB SQL https://neon.com
- La aplicación se conecta con la red Testnet de Hedera en el servidor mediante el SDK oficial de JavaScript de Hedera (`@hiero-ledger/sdk` / `@hashgraph/sdk`) https://docs.hedera.com/native/quickstart/javascript y en el cliente mediante `@hashgraph/hedera-wallet-connect`
- La aplicación utiliza la API de Pinata (IPFS) desde el backend para almacenar automáticamente los archivos PNG subidos por el administrador y sus correspondientes documentos JSON de metadata bajo el estándar HIP-412
- La aplicación debe tener diseño responsive y debe funcionar en dispositivos móviles como celulares, tabletas y también en computadores de escritorio

## Características de seguridad
- Generar un archivo .gitignore adecuado para un proyecto de este tipo, que incluya como mínimo `.env`, `node_modules`, `.nuxt`, `.output` y archivos de logs
- Colocar en todas las páginas de la aplicación (incluida la del administrador) un banner o marquesina fijo que nunca se mueva en letras pequeñas pero con colores llamativos fuertes el siguiente texto: "Esta web es exclusivamente de uso educativo e informativo. Contiene datos de prueba en ambiente Testnet. No tiene ningún valor comercial ni real"
- Cualquier información confidencial será guardada en el archivo .env
- Esta aplicación es para uso educativo solamente
- Esta aplicación solamente es para uso demostrativo de la tecnología Hedera y solamente en ambiente de prueba Testnet
- Las variables para conexión a Hedera están en el archivo .env en OPERATOR_ID y OPERATOR_KEY (DER Encoded Private Key)
- La conexión de billetera en el navegador utiliza el identificador de proyecto definido en la variable WALLETCONNECT_PROJECT_ID del archivo .env
- El token de autenticación para publicar archivos e información de metadata NFT en IPFS mediante Pinata está definido en la variable PINATA_JWT del archivo .env
- La pantalla del administrador está protegida por una contraseña especificada en el archivo .env, variable ADMIN_SCREEN_PASSWORD
- La sesión del administrador se firma con el valor de la variable SESSION_SECRET del archivo .env (cadena aleatoria de al menos 32 caracteres)
- La base de datos es Neon DB y su acceso está en el archivo .env, variable NEON_DB
- Nunca registrar en los logs del servidor el contenido de las peticiones que incluyan llaves privadas o contraseñas
- El cliente se conectará a la aplicación a través de la billetera Web3 HashPack

## Documentación
- Genera un archivo readme.md con instrucciones de lo que se necesita para ejecutar el proyecto en modo local y para desplegarlo en Railway
