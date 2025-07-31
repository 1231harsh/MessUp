package com.messUp.controller;

import com.messUp.DTO.AuthResponse;
import com.messUp.DTO.LoginRequest;
import com.messUp.DTO.RegisterRequest;
import com.messUp.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);

        addCookie(response, "jwt", authResponse.getToken(), 60 * 60 * 10);        // 10 hours
        addCookie(response, "refreshToken", authResponse.getRefreshToken(), 60 * 60 * 24 * 7); // 7 days

        return ResponseEntity.ok(Map.of("message", "Login successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(value = "refreshToken", required = false) String refreshToken,
                                     HttpServletResponse response) {
        if (refreshToken == null || refreshToken.trim().isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Refresh token missing"));
        }

        try {
            AuthResponse authResponse = authService.refreshToken(refreshToken);

            addCookie(response, "jwt", authResponse.getToken(), 60 * 60 * 10);        // 10 hours
            addCookie(response, "refreshToken", authResponse.getRefreshToken(), 60 * 60 * 24 * 7); // 7 days

            return ResponseEntity.ok(authResponse);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        deleteCookie(response, "jwt");
        deleteCookie(response, "refreshToken");
        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    // ---------- Cookie Helpers ----------

    private void addCookie(HttpServletResponse response, String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", "None"); // Crucial for cross-site cookies (Vercel ↔ Render)
        response.addCookie(cookie);
    }

    private void deleteCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, null);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "None");
        response.addCookie(cookie);
    }
}
