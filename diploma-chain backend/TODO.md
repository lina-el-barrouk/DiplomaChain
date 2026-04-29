# 🛠️ Plan de corrections – DiplomaChain

## ✅ Phase 1 : Sécurité & Authentification (CRITIQUE)

- [x] 1.1 Fix `security.py` – Passer de `argon2` à `bcrypt` (correspond à `requirements.txt`)
- [x] 1.2 Fix `security.py` – Rendre `FERNET_KEY` obligatoire pour éviter la perte de données
- [x] 1.3 Fix `auth.py` – Ajouter les imports manquants (`encrypt_sensitive`, `Student`, `Institution`)
- [x] 1.4 Fix `auth.py` – Mettre `is_verified=False` à l'inscription
- [x] 1.5 Fix `auth.py` – Réordonner les vérifications de login (`is_active` → `is_verified` → `approved`)
- [x] 1.6 Fix `auth.py` – Corriger la logique de rejet d'institution
- [x] 1.7 Fix `auth.py` – Implémenter le logout avec blacklist du token (JTI)
- [x] 1.8 Fix `qr.py` – Supprimer le fallback dangereux `if not institution: return diploma`

## ✅ Phase 2 : Base de données & Modèles

- [x] 2.1 Fix `alembic/env.py` – Ajouter l'import de `DiplomaTemplate`
- [x] 2.2 Fix `scripts/init.sql` – Retirer les variables d'environnement non supportées
- [x] 2.3 Fix `models.py` – La relation `approved_by` est déjà une FK simple (pas besoin de relation ORM supplémentaire)

## ✅ Phase 3 : API & Routing

- [x] 3.1 Fix `diplomas.py` – Déplacer `/verify/{code}/history` vers `/history/{code}` pour éviter le shadowing
- [x] 3.2 Fix `diplomas.py` – Réécrire `create_diploma_with_file` avec `Form()` au lieu de `Depends()`
- [x] 3.3 Fix `pdf.py` – Supprimer la clé `"message"` dupliquée dans `get_my_template`
- [x] 3.4 Fix `pdf_service.py` – Le paramètre `field_positions` est déjà supporté

## ✅ Phase 4 : Docker & Infrastructure

- [x] 4.1 Fix `docker-compose.yml` – Retirer `--ssl-mode=REQUIRED` (flag client invalide sur serveur)
- [x] 4.2 Fix `docker-compose.yml` – Corriger le healthcheck MySQL (sans mot de passe)
- [x] 4.3 Fix `docker-compose.yml` – Corriger le healthcheck Redis (ajouter le mot de passe)
- [x] 4.4 Fix `docker-compose.yml` – Corriger le healthcheck API (utiliser `python -c` au lieu de `curl`)
- [x] 4.5 Fix `config.py` – Ajouter `DB_ROOT_PASSWORD` et mettre à jour `REDIS_URL` avec mot de passe
- [x] 4.6 Fix `config.py` – Changer le `DB_HOST` par défaut en `mysql` pour Docker
- [x] 4.7 Fix `Dockerfile` – Installer `curl` pour les healthchecks

## ✅ Phase 5 : Blockchain / Hedera

- [x] 5.1 Fix `hedera_service.py` – Corriger l'URL mainnet
- [x] 5.2 Fix `diploma_service.py` – Nettoyer l'assignation `hedera_topic_id`
- [x] 5.3 Ajouter un commentaire clair que `_submit_hcs_message` est mocké

## ✅ Phase 6 : Tests

- [x] 6.1 Fix `test_core.py` – Adapter le test de préfixe de hash selon bcrypt
- [x] 6.2 Fix `conftest.py` – Ajouter l'import de `DiplomaTemplate`

## ✅ Phase 7 : Qualité du code & Corrections mineures

- [x] 7.1 Fix `deps.py` – Ajouter `"verifier"` dans `require_any`
- [x] 7.2 Fix `main.py` – Conditionner `Base.metadata.create_all` à `settings.DEBUG`
- [x] 7.3 Fix `auth.py` – Appeler la tâche Celery `send_verification_email` à l'inscription
- [x] 7.4 Fix `institutions.py` – Ajouter le paramètre `reason` à `reject_institution`
