# DiplomaChain – Backend API

Système de gestion et de vérification de diplômes infalsifiables, ancré sur la blockchain **Hedera Hashgraph**.

---

## 🏗️ Architecture

```
diploma-chain/
├── app/
│   ├── main.py                  ← FastAPI + middlewares de sécurité
│   ├── core/
│   │   ├── config.py            ← Configuration (Pydantic Settings)
│   │   └── security.py          ← JWT, bcrypt, SHA-256, AES-256
│   ├── db/
│   │   └── database.py          ← SQLAlchemy engine + sessions MySQL
│   ├── models/
│   │   └── models.py            ← ORM : Users, Institutions, Diplomas…
│   ├── schemas/
│   │   └── diploma.py           ← Validation Pydantic (requêtes/réponses)
│   ├── services/
│   │   ├── diploma_service.py   ← Logique métier diplômes
│   │   └── hedera_service.py    ← Intégration Hedera HCS
│   └── api/v1/
│       ├── deps.py              ← Injection JWT + RBAC
│       └── endpoints/
│           ├── auth.py          ← Register / Login / Logout
│           └── diplomas.py      ← CRUD diplômes + vérification
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## 🔐 Mécanismes de sécurité

| Couche | Technologie | Détail |
|--------|-------------|--------|
| **Authentification** | JWT HS256 | Access (30 min) + Refresh (7 jours) |
| **Mots de passe** | bcrypt (rounds=12) | Hachage unidirectionnel |
| **Intégrité diplômes** | SHA-256 | Hash canonique JSON signé |
| **Blockchain** | Hedera HCS | Ancrage immuable sur Topic HCS |
| **Données sensibles** | AES-256 (Fernet) | Chiffrement en base |
| **Anti brute-force** | Lockout temporaire | 5 échecs → verrouillage 15 min |
| **Rate limiting** | slowapi + Redis | 60 req/min par IP |
| **JWT Blacklist** | MySQL | Révocation à la déconnexion |
| **En-têtes HTTP** | Middleware FastAPI | HSTS, CSP, X-Frame-Options… |
| **CORS** | FastAPI CORS | Origines whitelistées |
| **Base de données** | MySQL 8 strict mode | UTF-8 mb4, SSL, STRICT_TRANS |

---

## 🌐 Flux Hedera HCS

```
Établissement émet diplôme
        ↓
compute_diploma_hash(data) → SHA-256
        ↓
HederaService.anchor_diploma()
        ↓
TopicMessageSubmitTransaction → Topic HCS
        ↓
Consensus en ~3 secondes
        ↓
Stockage : transaction_id + sequence_number en MySQL
        ↓
Vérification : mirrornode.hedera.com/api/v1/topics/{topic}/messages/{seq}
```

---

## 🚀 Démarrage rapide

### 1. Variables d'environnement

```bash
cp .env.example .env
# Éditer .env avec vos vraies valeurs
```

### 2. Créer un Topic HCS sur Hedera

```bash
# Sur le portail Hedera : https://portal.hedera.com
# Ou via le SDK :
python -c "
import asyncio
from app.services.hedera_service import hedera_service
asyncio.run(hedera_service.create_topic('DiplomaChain Degrees'))
"
```

### 3. Lancer avec Docker Compose

```bash
docker-compose up -d
```

### 4. Sans Docker (développement)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 📡 Endpoints principaux

### Authentification
```
POST /api/v1/auth/register        → Créer un compte
POST /api/v1/auth/login           → Connexion (JWT)
POST /api/v1/auth/refresh         → Renouveler le token
POST /api/v1/auth/logout          → Déconnexion
GET  /api/v1/auth/verify-email/{token}
```

### Diplômes
```
POST /api/v1/diplomas/            → Créer un diplôme (institution)
POST /api/v1/diplomas/{id}/issue  → Émettre + ancrer sur Hedera
POST /api/v1/diplomas/{id}/revoke → Révoquer
GET  /api/v1/diplomas/verify/{code} → Vérification publique (sans auth)
GET  /api/v1/diplomas/            → Liste des diplômes
GET  /api/v1/diplomas/{id}        → Détails
```

### Santé
```
GET /health                       → Statut API
```

---

## 👥 Rôles

| Rôle | Accès |
|------|-------|
| `admin` | Tout + approbation des institutions |
| `institution` | Créer/émettre/révoquer ses diplômes |
| `student` | Voir ses propres diplômes |
| `verifier` | Vérification publique + audit |

---

## 🔧 Production

- Remplacer la clé Fernet par une clé stockée dans **AWS KMS / HashiCorp Vault**
- Intégrer le **SDK Hedera Python officiel** (`hedera-sdk-py`) pour la soumission des transactions
- Configurer **Nginx** en reverse proxy avec SSL/TLS
- Activer **Alembic** pour les migrations de schéma
- Mettre en place **Sentry** pour le monitoring des erreurs

---

## 📄 Licence

MIT – DiplomaChain 2024
