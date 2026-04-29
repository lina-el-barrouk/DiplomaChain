-- DiplomaChain – Initialisation MySQL
-- Exécuté automatiquement au premier démarrage du conteneur

-- Sécuriser le compte root
ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${DB_ROOT_PASSWORD}';

-- Créer la base avec encodage UTF-8 complet
CREATE DATABASE IF NOT EXISTS `diplomachain`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Accorder uniquement les permissions nécessaires à l'utilisateur applicatif
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
  ON `diplomachain`.* TO '${DB_USER}'@'%';

-- Révoquer les permissions inutiles
