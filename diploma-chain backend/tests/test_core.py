"""
DiplomaChain – Tests unitaires
Couverture : sécurité, service diplômes, hachage, tokens
"""
import pytest
from datetime import datetime, timezone


# ─────────────────────────────────────────────────────────────────────────────
# TESTS : SÉCURITÉ (security.py)
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_password_returns_bcrypt(self):
        from app.core.security import hash_password
        hashed = hash_password("TestPassword123!")
        assert hashed.startswith("$2b$")
        assert hashed != "TestPassword123!"

    def test_verify_password_correct(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password("SecurePass@99")
        assert verify_password("SecurePass@99", hashed) is True

    def test_verify_password_wrong(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password("SecurePass@99")
        assert verify_password("WrongPassword", hashed) is False

    def test_different_passwords_different_hashes(self):
        from app.core.security import hash_password
        h1 = hash_password("Password123!")
        h2 = hash_password("Password123!")
        assert h1 != h2  # Salt différent à chaque fois


class TestJWT:
    def test_create_and_decode_access_token(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token(subject="user-123", role="institution")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "institution"
        assert payload["type"] == "access"
        assert "jti" in payload

    def test_create_refresh_token(self):
        from app.core.security import create_refresh_token, decode_token
        token = create_refresh_token(subject="user-456")
        payload = decode_token(token)
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"

    def test_invalid_token_raises(self):
        from jose import JWTError
        from app.core.security import decode_token
        with pytest.raises(JWTError):
            decode_token("invalid.token.here")


class TestDiplomaHash:
    def test_hash_is_deterministic(self):
        from app.core.security import compute_diploma_hash
        data = {
            "unique_code": "DC-TEST-1234-ABCD",
            "student_id": "stu-1",
            "institution_id": "inst-1",
            "degree_title": "Master Informatique",
            "field_of_study": "IA",
            "graduation_date": "2024-06-15T00:00:00",
            "honors": "Mention Très Bien",
        }
        h1 = compute_diploma_hash(data)
        h2 = compute_diploma_hash(data)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 = 64 hex chars

    def test_hash_changes_on_modification(self):
        from app.core.security import compute_diploma_hash
        data = {"degree_title": "Licence", "student_id": "s1", "institution_id": "i1",
                "unique_code": "DC-AAAA-BBBB-CCCC", "field_of_study": "Droit",
                "graduation_date": "2024-01-01", "honors": None}
        original = compute_diploma_hash(data)
        data["degree_title"] = "Master"  # Modification
        modified = compute_diploma_hash(data)
        assert original != modified

    def test_verify_diploma_hash_valid(self):
        from app.core.security import compute_diploma_hash, verify_diploma_hash
        data = {"degree_title": "Doctorat", "student_id": "s2", "institution_id": "i2",
                "unique_code": "DC-DDDD-EEEE-FFFF", "field_of_study": "Chimie",
                "graduation_date": "2023-07-01", "honors": "Félicitations"}
        h = compute_diploma_hash(data)
        assert verify_diploma_hash(data, h) is True

    def test_verify_diploma_hash_tampered(self):
        from app.core.security import compute_diploma_hash, verify_diploma_hash
        data = {"degree_title": "Doctorat", "student_id": "s3", "institution_id": "i3",
                "unique_code": "DC-GGGG-HHHH-IIII", "field_of_study": "Bio",
                "graduation_date": "2023-05-01", "honors": None}
        h = compute_diploma_hash(data)
        data["degree_title"] = "Faux Doctorat"  # Falsification !
        assert verify_diploma_hash(data, h) is False

    def test_file_hash(self):
        from app.core.security import compute_file_hash
        content = b"Contenu du PDF du diplome"
        h = compute_file_hash(content)
        assert len(h) == 64
        assert compute_file_hash(content) == h  # déterministe


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from app.core.security import decrypt_sensitive, encrypt_sensitive
        original = "Ahmed Ben Ali | CIN: AB123456"
        encrypted = encrypt_sensitive(original)
        assert encrypted != original
        decrypted = decrypt_sensitive(encrypted)
        assert decrypted == original

    def test_different_encryptions_same_plaintext(self):
        from app.core.security import encrypt_sensitive
        # Fernet génère un IV aléatoire → deux chiffrements différents
        e1 = encrypt_sensitive("secret")
        e2 = encrypt_sensitive("secret")
        assert e1 != e2


# ─────────────────────────────────────────────────────────────────────────────
# TESTS : SERVICE DIPLÔMES
# ─────────────────────────────────────────────────────────────────────────────

class TestUniqueCodeGeneration:
    def test_format(self):
        from app.services.diploma_service import generate_unique_code
        code = generate_unique_code()
        parts = code.split("-")
        assert len(parts) == 4
        assert parts[0] == "DC"
        assert all(len(p) == 4 for p in parts[1:])

    def test_uniqueness(self):
        from app.services.diploma_service import generate_unique_code
        codes = {generate_unique_code() for _ in range(1000)}
        assert len(codes) == 1000  # Tous uniques

    def test_no_ambiguous_chars(self):
        from app.services.diploma_service import generate_unique_code
        for _ in range(100):
            code = generate_unique_code().replace("-", "")
            assert "O" not in code
            assert "I" not in code
            assert "0" not in code
            assert "1" not in code


# ─────────────────────────────────────────────────────────────────────────────
# TESTS : SCHEMAS (validation Pydantic)
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordValidation:
    def test_weak_password_rejected(self):
        from pydantic import ValidationError
        from app.schemas.diploma import UserRegister
        with pytest.raises(ValidationError):
            UserRegister(email="test@example.com", password="weakpassword", role="student")

    def test_short_password_rejected(self):
        from pydantic import ValidationError
        from app.schemas.diploma import UserRegister
        with pytest.raises(ValidationError):
            UserRegister(email="test@example.com", password="Sh0rt!", role="student")

    def test_strong_password_accepted(self):
        from app.schemas.diploma import UserRegister
        user = UserRegister(
            email="test@example.com",
            password="SecurePass123!@#",
            role="institution",
        )
        assert user.email == "test@example.com"

    def test_invalid_role_rejected(self):
        from pydantic import ValidationError
        from app.schemas.diploma import UserRegister
        with pytest.raises(ValidationError):
            UserRegister(email="t@t.com", password="SecurePass123!", role="hacker")
