package com.drowsiness.detection.repository;

import com.drowsiness.detection.model.DrowsinessLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DrowsinessLogRepository extends JpaRepository<DrowsinessLog, Long> {
    List<DrowsinessLog> findByUsernameOrderByTimestampDesc(String username);
    long countByUsername(String username);
    long countByUsernameAndEventType(String username, String eventType);
}
