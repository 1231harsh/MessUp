package com.messUp.service;

import com.messUp.entity.Media;
import com.messUp.repository.MediaRepository;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaService {
    private static final long MAX_ENCRYPTED_IMAGE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            MediaType.IMAGE_GIF_VALUE,
            "image/webp"
    );

    private final MediaRepository mediaRepository;

    public MediaService(MediaRepository mediaRepository) {
        this.mediaRepository = mediaRepository;
    }

    public String storeEncryptedImage(MultipartFile file,
                                      String receiverId,
                                      String senderId,
                                      String contentType)  {
        validateEncryptedImage(file, receiverId, senderId, contentType);

        String mediaId = UUID.randomUUID().toString();

        try{
            Media media = Media.builder()
                    .id(mediaId)
                    .senderId(senderId)
                    .receiverId(receiverId)
                    .encryptedData(file.getBytes())
                    .contentType(contentType)
                    .size(file.getSize())
                    .uploadTimestamp(Instant.now())
                    .build();

            mediaRepository.save(media);
        }
        catch (IOException e){
            throw new RuntimeException("Failed to store media", e);
        }

        return mediaId;
    }


    public Media getMedia(String mediaId, String requesterId) {

        Media media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new RuntimeException("Media not found with ID: " + mediaId));
        if(!media.getReceiverId().equals(requesterId)&&!media.getSenderId().equals(requesterId)){
            throw new AccessDeniedException("Access denied to media with ID: " + mediaId);
        }
        return media;
    }

    private void validateEncryptedImage(MultipartFile file,
                                        String receiverId,
                                        String senderId,
                                        String contentType) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        if (file.getSize() > MAX_ENCRYPTED_IMAGE_SIZE_BYTES) {
            throw new IllegalArgumentException("File exceeds 5MB limit");
        }

        if (receiverId == null || receiverId.isBlank()) {
            throw new IllegalArgumentException("Receiver is required");
        }

        if (senderId == null || senderId.isBlank()) {
            throw new IllegalArgumentException("Sender is required");
        }

        if (contentType == null || !ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Unsupported image type");
        }
    }
}
