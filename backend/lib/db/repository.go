package db

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"gorm.io/gorm"
)

type UserRepositoryInterface interface {
	CreateUser(user *User) error
	GetUserByID(id uint) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserByUsername(username string) (*User, error)
	UpdateUser(user *User) error
	DeleteUser(id uint) error
	UpdateLastLogin(id uint) error
	CreateOAuthProvider(provider *OAuthProvider) error
	GetOAuthProvider(provider, providerID string) (*OAuthProvider, error)
	UpdateOAuthProvider(provider *OAuthProvider) error
	CreateRefreshToken(token *RefreshToken) error
	GetRefreshToken(tokenHash string) (*RefreshToken, error)
	RevokeRefreshToken(tokenHash string) error
	CleanupExpiredTokens() error
}

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepositoryInterface {
	return &UserRepository{db: db}
}

func (r *UserRepository) CreateUser(user *User) error {
	if err := r.db.Create(user).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			if strings.Contains(err.Error(), "email") {
				return fmt.Errorf("email already exists")
			}
			if strings.Contains(err.Error(), "username") {
				return fmt.Errorf("username already exists")
			}
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (r *UserRepository) GetUserByID(id uint) (*User, error) {
	var user User
	err := r.db.First(&user, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) GetUserByEmail(email string) (*User, error) {
	var user User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) GetUserByUsername(username string) (*User, error) {
	var user User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) UpdateUser(user *User) error {
	if err := r.db.Save(user).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("email or username already exists")
		}
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

func (r *UserRepository) DeleteUser(id uint) error {
	if err := r.db.Delete(&User{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

func (r *UserRepository) UpdateLastLogin(id uint) error {
	now := time.Now()
	if err := r.db.Model(&User{}).Where("id = ?", id).Update("last_login", now).Error; err != nil {
		return fmt.Errorf("failed to update last login: %w", err)
	}
	return nil
}

func (r *UserRepository) CreateOAuthProvider(provider *OAuthProvider) error {
	if err := r.db.Create(provider).Error; err != nil {
		return fmt.Errorf("failed to create oauth provider: %w", err)
	}
	return nil
}

func (r *UserRepository) GetOAuthProvider(provider, providerID string) (*OAuthProvider, error) {
	var oauthProvider OAuthProvider
	err := r.db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&oauthProvider).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("oauth provider not found")
		}
		return nil, fmt.Errorf("failed to get oauth provider: %w", err)
	}
	return &oauthProvider, nil
}

func (r *UserRepository) UpdateOAuthProvider(provider *OAuthProvider) error {
	if err := r.db.Save(provider).Error; err != nil {
		return fmt.Errorf("failed to update oauth provider: %w", err)
	}
	return nil
}

func (r *UserRepository) CreateRefreshToken(token *RefreshToken) error {
	if err := r.db.Create(token).Error; err != nil {
		return fmt.Errorf("failed to create refresh token: %w", err)
	}
	return nil
}

func (r *UserRepository) GetRefreshToken(tokenHash string) (*RefreshToken, error) {
	var token RefreshToken
	err := r.db.Where("token_hash = ? AND revoked = false AND expires_at > ?", tokenHash, time.Now()).First(&token).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("refresh token not found")
		}
		return nil, fmt.Errorf("failed to get refresh token: %w", err)
	}
	return &token, nil
}

func (r *UserRepository) RevokeRefreshToken(tokenHash string) error {
	if err := r.db.Model(&RefreshToken{}).Where("token_hash = ?", tokenHash).Update("revoked", true).Error; err != nil {
		return fmt.Errorf("failed to revoke refresh token: %w", err)
	}
	return nil
}

func (r *UserRepository) CleanupExpiredTokens() error {
	err := r.db.Where("expires_at < ? OR revoked = ?", time.Now(), true).Delete(&RefreshToken{}).Error
	if err != nil {
		return fmt.Errorf("failed to cleanup expired tokens: %w", err)
	}
	return nil
}