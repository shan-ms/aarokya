use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symptom {
    pub name: String,
    pub severity: String, // "mild", "moderate", "severe"
    pub duration: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CheckinRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub family_member_id: Option<Uuid>,
    pub symptoms: serde_json::Value,
    pub urgency_level: String,
    pub recommendation: String,
    pub additional_notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCheckinRequest {
    pub symptoms: Vec<Symptom>,
    pub family_member_id: Option<Uuid>,
    pub additional_notes: Option<String>,
}

/// Triage result returned from the check-in
#[derive(Debug, Serialize)]
pub struct TriageResult {
    pub urgency_level: String,
    pub recommendation: String,
    pub suggested_actions: Vec<String>,
    pub emergency: bool,
}

// Emergency symptom keywords
const EMERGENCY_KEYWORDS: &[&str] = &[
    "chest pain",
    "breathing difficulty",
    "unconscious",
    "severe bleeding",
    "stroke",
    "heart attack",
    "seizure",
    "choking",
    "poisoning",
    "suicidal",
    "head injury",
    "paralysis",
    "anaphylaxis",
];

const URGENT_KEYWORDS: &[&str] = &[
    "high fever",
    "persistent vomiting",
    "severe pain",
    "blood in stool",
    "blood in urine",
    "fainting",
    "confusion",
    "swelling",
    "allergic reaction",
    "dehydration",
];

pub fn triage_symptoms(symptoms: &[Symptom]) -> TriageResult {
    let all_text: String = symptoms
        .iter()
        .map(|s| {
            format!(
                "{} {} {}",
                s.name,
                s.severity,
                s.duration.as_deref().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();

    // Check for emergency
    let is_emergency = EMERGENCY_KEYWORDS.iter().any(|kw| all_text.contains(kw));
    if is_emergency {
        return TriageResult {
            urgency_level: "emergency".to_string(),
            recommendation: "This may be a medical emergency. Please call emergency services (112) immediately or go to the nearest emergency room.".to_string(),
            suggested_actions: vec![
                "Call 112 (Emergency Services)".to_string(),
                "Go to nearest emergency room".to_string(),
                "Do not delay seeking help".to_string(),
            ],
            emergency: true,
        };
    }

    // Check for urgent
    let is_urgent = URGENT_KEYWORDS.iter().any(|kw| all_text.contains(kw));
    let has_severe = symptoms.iter().any(|s| s.severity == "severe");
    if is_urgent || has_severe {
        return TriageResult {
            urgency_level: "urgent".to_string(),
            recommendation: "Your symptoms suggest you should see a doctor soon. Consider booking a teleconsult or visiting a clinic today.".to_string(),
            suggested_actions: vec![
                "Book a teleconsult".to_string(),
                "Visit a nearby clinic".to_string(),
                "Monitor symptoms closely".to_string(),
            ],
            emergency: false,
        };
    }

    // Check for moderate
    let has_moderate = symptoms.iter().any(|s| s.severity == "moderate");
    if has_moderate {
        return TriageResult {
            urgency_level: "schedule_visit".to_string(),
            recommendation: "Your symptoms are moderate. Consider scheduling a doctor visit in the next few days.".to_string(),
            suggested_actions: vec![
                "Schedule a doctor visit".to_string(),
                "Rest and stay hydrated".to_string(),
                "Track your symptoms".to_string(),
                "Return if symptoms worsen".to_string(),
            ],
            emergency: false,
        };
    }

    // Self-care
    TriageResult {
        urgency_level: "self_care".to_string(),
        recommendation: "Your symptoms appear mild. You can manage them at home with self-care. If they persist or worsen, consider seeing a doctor.".to_string(),
        suggested_actions: vec![
            "Rest and stay hydrated".to_string(),
            "Take over-the-counter medication if needed".to_string(),
            "Track your symptoms".to_string(),
            "See a doctor if symptoms persist beyond 3 days".to_string(),
        ],
        emergency: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn symptom(name: &str, severity: &str, duration: Option<&str>) -> Symptom {
        Symptom {
            name: name.to_string(),
            severity: severity.to_string(),
            duration: duration.map(|d| d.to_string()),
        }
    }

    #[test]
    fn test_emergency_chest_pain() {
        let symptoms = vec![symptom("chest pain", "severe", Some("10 minutes"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
        assert!(result.emergency);
        assert!(result.recommendation.contains("112"));
    }

    #[test]
    fn test_emergency_breathing_difficulty() {
        let symptoms = vec![symptom("breathing difficulty", "severe", None)];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
        assert!(result.emergency);
    }

    #[test]
    fn test_emergency_stroke_keyword() {
        let symptoms = vec![symptom(
            "possible stroke symptoms",
            "severe",
            Some("30 min"),
        )];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
        assert!(result.emergency);
    }

    #[test]
    fn test_emergency_suicidal() {
        let symptoms = vec![symptom("suicidal thoughts", "severe", None)];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
        assert!(result.emergency);
    }

    #[test]
    fn test_urgent_high_fever() {
        let symptoms = vec![symptom("high fever", "moderate", Some("2 days"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "urgent");
        assert!(!result.emergency);
    }

    #[test]
    fn test_urgent_severe_severity() {
        let symptoms = vec![symptom("back pain", "severe", Some("1 day"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "urgent");
        assert!(!result.emergency);
    }

    #[test]
    fn test_urgent_blood_in_stool() {
        let symptoms = vec![symptom("blood in stool", "moderate", Some("1 day"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "urgent");
        assert!(!result.emergency);
    }

    #[test]
    fn test_schedule_visit_moderate() {
        let symptoms = vec![symptom("headache", "moderate", Some("3 days"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "schedule_visit");
        assert!(!result.emergency);
    }

    #[test]
    fn test_self_care_mild() {
        let symptoms = vec![symptom("runny nose", "mild", Some("1 day"))];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "self_care");
        assert!(!result.emergency);
    }

    #[test]
    fn test_self_care_multiple_mild() {
        let symptoms = vec![
            symptom("runny nose", "mild", Some("2 days")),
            symptom("mild cough", "mild", None),
        ];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "self_care");
        assert!(!result.emergency);
    }

    #[test]
    fn test_emergency_takes_priority_over_mild() {
        let symptoms = vec![
            symptom("runny nose", "mild", None),
            symptom("chest pain", "mild", Some("5 min")),
        ];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
        assert!(result.emergency);
    }

    #[test]
    fn test_mixed_moderate_and_mild() {
        let symptoms = vec![
            symptom("headache", "moderate", Some("1 day")),
            symptom("fatigue", "mild", Some("3 days")),
        ];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "schedule_visit");
        assert!(!result.emergency);
    }

    #[test]
    fn test_case_insensitive_matching() {
        let symptoms = vec![symptom("CHEST PAIN", "mild", None)];
        let result = triage_symptoms(&symptoms);
        assert_eq!(result.urgency_level, "emergency");
    }

    #[test]
    fn test_suggested_actions_not_empty() {
        let symptoms = vec![symptom("cough", "mild", None)];
        let result = triage_symptoms(&symptoms);
        assert!(!result.suggested_actions.is_empty());
    }

    #[test]
    fn test_all_emergency_keywords_detected() {
        for keyword in EMERGENCY_KEYWORDS {
            let symptoms = vec![symptom(keyword, "mild", None)];
            let result = triage_symptoms(&symptoms);
            assert_eq!(
                result.urgency_level, "emergency",
                "Expected emergency for keyword: {}",
                keyword
            );
        }
    }

    #[test]
    fn test_all_urgent_keywords_detected() {
        for keyword in URGENT_KEYWORDS {
            let symptoms = vec![symptom(keyword, "mild", None)];
            let result = triage_symptoms(&symptoms);
            assert_eq!(
                result.urgency_level, "urgent",
                "Expected urgent for keyword: {}",
                keyword
            );
        }
    }
}
