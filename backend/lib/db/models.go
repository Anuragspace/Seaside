package db

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Email          string         `gorm:"uniqueIndex;not null" json:"email"`
	Username       string         `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash   string         `gorm:"column:password_hash;not null" json:"-"`
	AvatarURL      *string        `gorm:"column:avatar_url" json:"avatar_url,omitempty"`
	Provider       string         `gorm:"column:provider;not null" json:"provider"`
	ProviderID     string         `gorm:"column:provider_id" json:"provider_id"`
	LastLogin      *time.Time     `gorm:"column:last_login" json:"last_login,omitempty"`
	EmailVerified  bool           `gorm:"column:email_verified;default:false" json:"email_verified"`
	Active         bool           `gorm:"column:active;default:true" json:"active"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

type OAuthProvider struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"not null;index" json:"user_id"`
	Provider     string    `gorm:"not null" json:"provider"`
	ProviderID   string    `gorm:"not null" json:"provider_id"`
	AccessToken  string    `gorm:"not null" json:"access_token"`
	RefreshToken string    `gorm:"not null" json:"refresh_token"`
	ExpiresAt    time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RefreshToken struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	TokenHash  string    `gorm:"not null" json:"token_hash"`
	ExpiresAt  time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
	Revoked    bool      `gorm:"not null;default:false" json:"revoked"`
}