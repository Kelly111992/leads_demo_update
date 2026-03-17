# Usar una imagen de Node.js moderna
FROM node:20-slim

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./

# Instalar dependencias
# Nota: Instalamos todas porque tsx se usa para correr el servidor
RUN npm install

# Copiar el resto del código
COPY . .

# Construir el frontend de Vite
RUN npm run build

# Exponer el puerto que usa la aplicación
EXPOSE 3000

# Definir variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar la aplicación
# Usamos npm start que corre 'tsx server.ts'
CMD ["npm", "start"]
