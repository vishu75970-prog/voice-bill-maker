# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source (including .env, which Vite reads at build time
# to bake the Supabase URL + anon key into the client bundle)
COPY . .

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# Custom nginx config to serve the SPA on port 3000
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files into nginx's serve directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
