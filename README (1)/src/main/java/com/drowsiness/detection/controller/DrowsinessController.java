package com.drowsiness.detection.controller;

import com.drowsiness.detection.model.DrowsinessLog;
import com.drowsiness.detection.repository.DrowsinessLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drowsiness")
@CrossOrigin(origins = "*")
public class DrowsinessController {

    @Autowired
    private DrowsinessLogRepository logRepository;

    @PostMapping("/log")
    public ResponseEntity<DrowsinessLog> logDrowsiness(@RequestBody DrowsinessLog log) {
        if (log.getTimestamp() == null) {
            log.setTimestamp(LocalDateTime.now());
        }
        if (log.getStatus() == null) {
            log.setStatus("Drowsiness Detected ⚠️");
        }
        DrowsinessLog savedLog = logRepository.save(log);
        return ResponseEntity.ok(savedLog);
    }

    @GetMapping("/history/{username}")
    public ResponseEntity<List<DrowsinessLog>> getHistory(@PathVariable String username) {
        List<DrowsinessLog> logs = logRepository.findByUsernameOrderByTimestampDesc(username);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/stats/{username}")
    public ResponseEntity<?> getStats(@PathVariable String username) {
        long totalIncidents = logRepository.countByUsername(username);
        long eyesClosedCount = logRepository.countByUsernameAndEventType(username, "EYES_CLOSED");
        long yawningCount = logRepository.countByUsernameAndEventType(username, "YAWNING");
        long microsleepCount = logRepository.countByUsernameAndEventType(username, "MICROSLEEP");

        // Fetch last 10 logs for a quick table preview in dashboard
        List<DrowsinessLog> allLogs = logRepository.findByUsernameOrderByTimestampDesc(username);
        List<DrowsinessLog> recentLogs = allLogs.subList(0, Math.min(allLogs.size(), 5));

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", totalIncidents);
        stats.put("eyesClosed", eyesClosedCount);
        stats.put("yawning", yawningCount);
        stats.put("microsleep", microsleepCount);
        stats.put("recentLogs", recentLogs);

        // Prepare monthly/daily trend chart mock data structure to let JS parse it cleanly
        // We will pass the full list of logs and let JavaScript chart it dynamically!
        // This is much cleaner and allows highly dynamic, beautiful client-side filters.
        stats.put("allLogs", allLogs);

        return ResponseEntity.ok(stats);
    }

    @PutMapping("/resolve/{id}")
    public ResponseEntity<?> resolveLog(@PathVariable Long id) {
        return logRepository.findById(id)
            .map(log -> {
                log.setStatus("Resolved ✅");
                logRepository.save(log);
                Map<String, String> response = new HashMap<>();
                response.put("message", "Log status updated to Resolved");
                return ResponseEntity.ok(response);
            })
            .orElse(ResponseEntity.notFound().build());
    }
}
