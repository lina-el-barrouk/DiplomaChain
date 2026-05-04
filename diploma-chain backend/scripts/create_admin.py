"""
Script de création d'un compte admin de test.
Usage : python scripts/create_admin.py
"""
import sys
import os

# Ajouter le répertoire racine au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, engine
from app.models.models import Base, User
from app.core.security import hash_password

EMAIL = "admin@diplomachain.com"
PASSWORD = "Admin@12345!"

def create_admin():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == EMAIL).first()
        if existing:
            print(f"✓ Admin déjà existant : {EMAIL}")
            print(f"  Role    : {existing.role}")
            print(f"  Actif   : {existing.is_active}")
            print(f"  Vérifié : {existing.is_verified}")
            # S'assurer que le compte est bien actif/vérifié
            existing.is_active = True
            existing.is_verified = True
            existing.failed_logins = 0
            existing.locked_until = None
            existing.password_hash = hash_password(PASSWORD)
            db.commit()
            print(f"  → Mot de passe réinitialisé et compte déverrouillé.")
        else:
            admin = User(
                email=EMAIL,
                password_hash=hash_password(PASSWORD),
                role="admin",
                is_active=True,
                is_verified=True,
                failed_logins=0,
            )
            db.add(admin)
            db.commit()
            print(f"✓ Admin créé avec succès !")

        print(f"\n  Email    : {EMAIL}")
        print(f"  Password : {PASSWORD}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
