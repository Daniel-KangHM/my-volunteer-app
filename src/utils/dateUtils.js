import { Timestamp } from 'firebase/firestore';

// Firestore Timestamp 또는 문자열을 Date 객체로 변환
export const parseFirestoreDate = (date) => {
  if (date instanceof Timestamp) {
    return date.toDate();
  } else if (typeof date === 'string') {
    return new Date(date);
  } else if (date instanceof Date) {
    return date; // 이미 Date 객체면 그대로 반환
  }
  console.error("잘못된 날짜 형식:", date);
  return null; // 잘못된 경우 null 반환
};

// Date 객체를 한국어 형식으로 포맷팅
export const formatDate = (date, options = { year: 'numeric', month: 'long', day: 'numeric' }) => {
  const parsedDate = parseFirestoreDate(date);
  if (!parsedDate) return "날짜 오류";
  return parsedDate.toLocaleDateString('ko-KR', options);
};

// 요일 반환
export const getDayOfWeek = (date) => {
  const parsedDate = parseFirestoreDate(date);
  if (!parsedDate) return "요일 오류";
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[parsedDate.getDay()];
};