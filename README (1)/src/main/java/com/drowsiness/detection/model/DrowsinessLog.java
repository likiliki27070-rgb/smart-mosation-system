package com.drowsiness.detection.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "drowsiness_logs")
public class DrowsinessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private String eventType; // EYES_CLOSED, YAWNING, MICROSLEEP

    private Double duration; // Duration of drowsiness in seconds

    private Double latitude;
    private Double longitude;
    
    private String address; // Salem, Tamil Nadu etc.

    @Column(nullable = false)
    private String status; // Alert Active / Resolved

    // Constructors
    public DrowsinessLog() {}

    public DrowsinessLog(String username, LocalDateTime timestamp, String eventType, Double duration, Double latitude, Double longitude, String address, String status) {
        this.username = username;
        this.timestamp = timestamp;
        this.eventType = eventType;
        this.duration = duration;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
        this.status = status;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public Double getDuration() {
        return duration;
    }

    public void setDuration(Double duration) {
        this.duration = duration;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
