# Tienda del aventurero

Aplicación web educativa para vender NFTs de prueba en **Hedera Testnet**. El proyecto está pensado únicamente con fines demostrativos y educativos: no tiene valor comercial ni uso en producción.

## Características

- Tienda responsive con temática de aventura/calabozo.
- Panel de administración protegido por contraseña.
- Creación de colecciones NFT con un solo token HTS y múltiples seriales.
- Subida de imágenes PNG desde el administrador; el backend publica la imagen y el JSON de metadata HIP-412 en IPFS mediante Pinata.
- Compra con formulario previo, conexión HashPack/WalletConnect, pago de 1 HBAR en Testnet y entrega del NFT mediante `TokenAirdropTransaction` (HIP-904).
- Verificación del pago contra Hedera Mirror Node y protección contra reutilización de transacciones.
- Sorteo de compradores con una oportunidad por cuenta Hedera única dentro de la colección activa.
- Interfaz en español mediante `@nuxtjs/i18n`.

## Arquitectura general

```mermaid
flowchart LR
    U(["Usuario"])

    subgraph Navegador
        FE["Frontend (Vue)<br/>Tienda, formulario y panel admin"]
        HP["HashPack<br/>(Billetera Web3)<br/>Firma y aprueba el pago"]
    end

    subgraph Servidor
        BE["Backend (Nuxt / Nitro)<br/>APIs, validación y lógica de negocio"]
    end

    subgraph Servicios en la nube
        DB[("Neon DB<br/>(Base de datos SQL)<br/>Colecciones y compradores")]
        IPFS["Pinata<br/>(Servicio IPFS)<br/>Imágenes PNG y metadata JSON"]
        HED["Hedera Testnet<br/>(DLT Web3)<br/>Token NFT, pagos y entregas"]
    end

    U --> FE
    U --> HP
    FE <-->|"WalletConnect"| HP
    FE <-->|"HTTP / JSON"| BE
    BE <-->|"SQL"| DB
    BE -->|"Sube archivos"| IPFS
    BE <-->|"Hedera SDK"| HED
    HP -->|"Envía pago de 1 HBAR"| HED
```

| Componente | Función |
| --- | --- |
| **Usuario** | Navega la tienda, completa el formulario y aprueba el pago desde su billetera. |
| **Frontend (Vue)** | Muestra la colección, el formulario de compra y el panel de administración. Nunca maneja claves privadas. |
| **HashPack** | Billetera Web3 del usuario. Se conecta mediante WalletConnect y firma la transacción de pago de 1 HBAR. |
| **Backend (Nuxt)** | Expone las APIs, valida datos, protege el panel admin y coordina todos los servicios externos. Es el único que conoce la clave del operador. |
| **Neon DB** | Base de datos PostgreSQL en la nube. Guarda colecciones, NFTs disponibles y compradores. |
| **Pinata (IPFS)** | Almacena las imágenes y su metadata HIP-412. Hedera solo guarda un enlace corto `ipfs://...` (máximo 100 bytes). |
| **Hedera Testnet** | Red DLT donde se crea el token NFT, se mintean los seriales, se recibe el pago y se entrega el NFT al comprador. |

### Flujo de compra simplificado

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend (Vue)
    participant HP as HashPack
    participant BE as Backend (Nuxt)
    participant HED as Hedera
    participant DB as Neon DB

    U->>FE: Completa el formulario
    FE->>HP: Solicita firmar pago de 1 HBAR
    U->>HP: Aprueba la transacción
    HP->>HED: Envía el pago
    FE->>BE: Registra la compra (ID de transacción)
    BE->>HED: Verifica el pago (Mirror Node)
    BE->>HED: Entrega el NFT (airdrop HIP-904)
    BE->>DB: Guarda comprador y serial
    BE-->>FE: Confirmación
```

**Detalles técnicos importantes:**

- **Separación de claves:** el usuario firma con su propia billetera; el backend firma solo con la cuenta operadora (`OPERATOR_KEY`), que nunca llega al navegador.
- **Doble registro en IPFS:** primero se sube la imagen PNG y luego un JSON HIP-412 que apunta a esa imagen. El CID del JSON es lo que se guarda en cada NFT.
- **Mirror Node:** servicio público de Hedera para consultar transacciones; el backend lo usa para confirmar que el pago realmente ocurrió.
- **Protección contra reutilización:** cada ID de transacción de pago se puede usar una sola vez (restricción `UNIQUE` en la base de datos).
- **Entrega con airdrop (HIP-904):** si la cuenta del comprador no puede recibir el NFT automáticamente, queda como "airdrop pendiente" para aceptarlo en HashPack.

## Requisitos

- Node.js `24.22.3` (ver `.nvmrc`).
- Cuenta de Hedera Testnet con HBAR de prueba.
- Cuenta de Pinata para IPFS.
- Proyecto de WalletConnect/Reown para HashPack.
- Base de datos PostgreSQL compatible con Neon.

## Variables de entorno

Crea un archivo `.env` local con estas variables. No subas `.env` al repositorio. Mira .env.sample como ejemplo

```env
OPERATOR_ID=0.0.xxxxx
OPERATOR_KEY=3030020100300706...
NEON_DB=postgres://user:pass@host/db?sslmode=require
ADMIN_SCREEN_PASSWORD=una-clave-larga-y-segura
SESSION_SECRET=otra-clave-larga-de-al-menos-32-caracteres
WALLETCONNECT_PROJECT_ID=tu_project_id_de_reown
PINATA_JWT=tu_jwt_de_pinata
```

Notas:

- `OPERATOR_KEY` es la llave privada DER/hex del operador de Hedera que actúa como tesorería.
- `SESSION_SECRET` debe tener al menos 32 caracteres.
- `WALLETCONNECT_PROJECT_ID` se obtiene en Reown Cloud. Mientras el *allowlist* de dominios esté vacío, funcionará en `localhost` y en Railway.
- `PINATA_JWT` solo se usa en el servidor; nunca se expone al cliente.

## Instalación y desarrollo local

```bash
nvm use
npm install
npm run dev
```

La app quedará disponible normalmente en `http://localhost:3000`.

## Build y verificación

```bash
npm run build
npm run preview
```

También puedes ejecutar `npx nuxi typecheck` si tu editor/configuración lo soporta; el build de Nuxt ya valida la compilación de la aplicación.

## Despliegue en Railway

1. Crea un proyecto en Railway e importa este repositorio.
2. Configura las variables de entorno anteriores en el dashboard de Railway.
3. Railway detectará Node por `.nvmrc`/`engines`; si lo necesitas, fija `NODE_VERSION=24.22.3`.
4. Usa el comando de build `npm run build` y el de inicio `node .output/server/index.mjs`.
5. Cuando tengas la URL pública `https://<tu-app>.up.railway.app`, agrégala al allowlist de dominios en Reown. Si también quieres seguir probando en local, agrega `http://localhost:3000`.
6. La base de datos Neon puede ser externa; `NEON_DB` ya apunta a tu instancia.

## Flujo principal

### Administración

1. Entra a `/admin` con `ADMIN_SCREEN_PASSWORD`.
2. En la pestaña **Crear colección**, escribe la descripción general.
3. Agrega de 1 a 5 NFTs; para cada uno escribe un nombre corto y sube un PNG.
4. El backend sube cada PNG a Pinata, genera el JSON HIP-412, lo sube a Pinata y acuña los seriales en Hedera Testnet.
5. La colección activa solo permite una a la vez. Borrar la colección la desactiva, pero conserva el historial de compras.

### Compra

1. El comprador entra a `/`, completa nombre, apellido, email y campos opcionales.
2. Conecta HashPack mediante WalletConnect/Reown.
3. Firma un envío de 1 HBAR hacia `OPERATOR_ID`.
4. El backend verifica la transacción en Mirror Node, reserva un serial disponible, envía el NFT por airdrop y guarda el registro.
5. Si el NFT queda como airdrop pendiente, la pantalla indica abrir HashPack y aceptar la recepción.

## Estructura relevante

- `app/pages/index.vue`: tienda pública.
- `app/pages/admin/index.vue`: administración.
- `app/components/PurchaseModal.vue`: formulario, wallet y confirmación de compra.
- `server/api/*`: endpoints públicos y de administración.
- `server/utils/hedera.ts`: cliente Hedera, mint, airdrop y verificación Mirror Node.
- `server/utils/pinata.ts`: publicación de imágenes y metadata JSON en IPFS.
- `server/utils/db.ts`: conexión Neon y creación de tablas.
- `i18n/locales/es.json`: mensajes visibles de la aplicación.

## Solución de problemas

- Los errores de API se registran en la consola del servidor y también se agregan como JSON en `logs/server-errors.log` para facilitar el diagnóstico.
- Si una creación de colección falla después de subir imágenes a Pinata, es posible que existan CIDs huérfanos en IPFS; la colección no se activa en Neon ni se muestran NFTs en la tienda hasta que el proceso complete correctamente.

## Aviso

Esta web es exclusivamente de uso educativo e informativo. Contiene datos de prueba en ambiente Testnet. No tiene ningún valor comercial ni real.
