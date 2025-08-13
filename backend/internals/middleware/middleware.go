package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CorsConfig() fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5173, http://localhost:5174, http://localhost:3000, https://anuragspace.github.io, https://seasides.vercel.app, https://seaside-backend-pw1v.onrender.com",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Upgrade, Connection",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
		ExposeHeaders:    "Content-Length, Content-Type",
	})
}
