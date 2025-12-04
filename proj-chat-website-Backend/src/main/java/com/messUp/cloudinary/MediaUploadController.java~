package com.messUp.cloudinary;

import com.messUp.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

@RestController
@RequestMapping("/api/upload")
public class MediaUploadController {

    private final MediaUploadService imageUploadService;
    private final UserService userService;

    public MediaUploadController(MediaUploadService imageUploadService, UserService userService) {
        this.imageUploadService = imageUploadService;
        this.userService = userService;
    }

    @PostMapping("/profile-picture")
    public ResponseEntity<?> uploadProfilePicture(@RequestParam("file") MultipartFile file, Principal principal) {
        try {
            String username = principal.getName();
            Long userId = userService.getIdByUsername(username);
            String imageUrl = imageUploadService.uploadMedia(file);
            userService.updateProfilePicture(userId, imageUrl);
            return ResponseEntity.ok("Profile picture updated successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error uploading profile picture: " + e.getMessage());
        }
    }

    @PostMapping("/message-media")
    public ResponseEntity<?> uploadMessageImage(@RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = imageUploadService.uploadMedia(file);
            return ResponseEntity.ok(imageUrl);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error uploading message image: " + e.getMessage());
        }
    }
}
