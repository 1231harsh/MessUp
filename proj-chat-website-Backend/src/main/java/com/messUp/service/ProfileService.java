package com.messUp.service;

import com.messUp.DTO.UserDTO;
import com.messUp.Utils.OtpGenerator;
import com.messUp.entity.User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class ProfileService {
    private final UserService userService;
    private final EmailService emailService;
    private final OtpGenerator otpGenerator ;

    public ProfileService(UserService userService, EmailService emailService, OtpGenerator otpGenerator) {
        this.userService = userService;
        this.emailService = emailService;
        this.otpGenerator = otpGenerator;
    }
    public UserDTO getProfile(String name) {
        User user= userService.getUserByUsername(name);
        return userService.mapToDTO(user);
    }

    public UserDTO updateProfile(UserDTO profile, String name) {
        User user= userService.getUserByUsername(name);
        user.setProfilePicture(profile.getProfilePicture());
        user.setProfilePictureContentType(profile.getProfilePictureContentType());
        user.setFirstName(profile.getFirstName());
        user.setLastName(profile.getLastName());
        user.setPhoneNumber(profile.getPhoneNumber());
        user.setDescription(profile.getDescription());
        userService.saveUser(user);
        return userService.mapToDTO(user);
    }

    public void setEmail(String newEmail, User user) {

        if (newEmail == null || newEmail.isBlank()) {
            throw new IllegalArgumentException("Email cannot be empty");
        }
        if (newEmail.equalsIgnoreCase(user.getEmail())) {
            throw new IllegalArgumentException("New email is same as current email");
        }
        String otp= otpGenerator.generateOtp(6);

        user.setPendingEmail(newEmail);
        user.setEmailChangeOtp(otp);
        user.setEmailChangeOtpExpiresAt(LocalDateTime.now().plusMinutes(10));

        userService.saveUser(user);

        String body="Your OTP for email change is: " + otp + "\nThis OTP is valid for 10 minutes.";
        emailService.sendEmail(newEmail, "Email Change OTP", body);

    }

    public void verifyEmailOtp(String otpInput, User user) {

        if (user.getPendingEmail() == null || user.getEmailChangeOtp() == null) {
            throw new IllegalStateException("No pending email change");
        }

        if (user.getEmailChangeOtpExpiresAt() == null ||
                user.getEmailChangeOtpExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("OTP has expired");
        }

        if (!otpInput.equals(user.getEmailChangeOtp())) {
            user.setEmailChangeOtpAttempts(user.getEmailChangeOtpAttempts() + 1);
            userService.saveUser(user);
            throw new IllegalArgumentException("Invalid OTP");
        }

        user.setEmail(user.getPendingEmail());
        user.setPendingEmail(null);
        user.setEmailChangeOtp(null);
        user.setEmailChangeOtpExpiresAt(null);
        user.setEmailChangeOtpAttempts(0);

        userService.saveUser(user);
    }

}
