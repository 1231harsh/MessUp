package com.messUp.Utils;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class OtpGenerator {
    private final SecureRandom random;
    public OtpGenerator() {
        this.random = new SecureRandom();
    }
    public String generateOtp(int length) {
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < length; i++) {
            otp.append(random.nextInt(10));
        }
        return otp.toString();
    }
}
