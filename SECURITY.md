🔐 JWT-Based Authentication in MessUp
This project implements stateless authentication using JWT (JSON Web Token) and Spring Security. Below is a complete overview of the authentication and authorization mechanism used.

✅ Overview

    The authentication flow uses:
    Spring Security for managing security configuration and filters.
    JWT (JSON Web Token) for stateless authentication.
    BCrypt for secure password encoding.
    CustomUserDetailsService for loading user data from the database.

🔄 Authentication Flow
    1. User Logs In
    
        Endpoint: POST /api/auth/login
        Body:
            {
              "username": "user1",
              "password": "password"
            }
    2. Backend Authentication Process

    AuthenticationManager triggers the authentication.
    DaoAuthenticationProvider uses CustomUserDetailsService to load the user.
    Password is verified using BCryptPasswordEncoder.    
    On success, a JWT token is generated and returned to the client.

📦 JWT Token

    Contains: username, issuedAt, expiration
    Signed using: HMAC SHA256
    Valid for: 10 hours

🛡 Authorization Flow
    1. Client Sends Authenticated Request
        Adds JWT token in the header:
        Authorization: Bearer <token>

    2. JwtAuthenticationFilter
        Extracts the JWT from the header.
        Uses JwtService to:
        
          1.Decode the token.
          2.Validate its signature and expiration.
          3.Extract the username.
        
        Loads user using CustomUserDetailsService.
        Creates an Authentication object and sets it in the SecurityContext.

⚙️ Configuration
    SecurityConfig.java
    Disables CSRF.
    Makes /api/auth/** public.
    Requires authentication for all other endpoints.
    
    Registers:
    
        1.JwtAuthenticationFilter
        2.DaoAuthenticationProvider     
        3.Stateless session policy
    
    JwtService.java

        1.Generates and verifies JWT tokens using a secure secret key.
        2.Uses the latest jjwt API (verifyWith(...)).
    
    CustomUserDetailsService.java

        1.Loads User from database using UserRepository.
        2.Returns a Spring-compatible UserDetails object.


🔑 End-to-End Encryption (E2EE)

Beyond authentication, MessUp implements E2EE to ensure that only communicating clients can read messages — even the server cannot decrypt them.

🎯 Goals

    Messages are encrypted before leaving the client.

    Server acts only as a relay — it never sees plaintext messages.

    The server only stores and forwards encrypted payloads.

    Private keys never leave the client (they are encrypted with a passphrase before being stored on the server)..

🔐 Key Management

    Key Pair Generation

    When a user creates an account, an RSA key pair (public/private) is generated.
    
    A passphrase is also set by the user.
    
    Public Key
    
    Stored on the server.
    
    Shared with contacts to allow them to encrypt messages for this user.
    
    Private Key
    
    Encrypted with the user’s passphrase.
    
    Stored securely on the server (cannot be decrypted without passphrase).
    
    Decrypted locally on the client when the user enters their passphrase.
    
    Local Storage
    
    Decrypted private key and user keys may be cached in localStorage for quick access.

📡 WebSocket Initialization

    Client connects to WebSocket.

    On success, session keys are loaded from localStorage.

    If not present, keys are generated and stored securely.

🔄 Message Flow

Sending:

    Sender encrypts the message using the recipient’s public key.
    
    The encrypted message is sent to the server.
    
    Server relays it to the recipient.

Receiving:

    Recipient receives the encrypted message.
    
    Uses their private key (decrypted locally with passphrase) to decrypt it.
    
    Displays the plaintext message.

🔒 Passphrase Protection

    Even if the server is compromised, private keys remain safe because they are encrypted with a user-specific passphrase.
    
    Only the user can unlock their private key locally.


🛡 Security Summary

    Authentication: Stateless JWT with Spring Security.
    
    Password Safety: BCrypt hashing.
    
    Authorization: JWT validation per request.
    
    Message Privacy: End-to-end encryption with RSA key pairs.
    
    Private Key Safety: Encrypted with passphrase before storage.
    
    Server Role: Acts only as a relay, cannot read messages.
