import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function MyPage() {
  const [userVolunteers, setUserVolunteers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [volunteers, setVolunteers] = useState({}); // 봉사자 수를 저장할 상태 추가
  const [eventDetails, setEventDetails] = useState({}); // 이벤트 세부 정보를 저장할 상태 추가

  useEffect(() => {
    // 현재 로그인한 사용자 가져오기
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // 사용자가 신청한 volunteer 데이터 가져오기
        const volunteersQuery = query(
          collection(db, "volunteers"),
          where("name", "==", user.email || "익명")
        );
        const unsubscribeUserVolunteers = onSnapshot(volunteersQuery, (querySnapshot) => {
          const volunteersData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setUserVolunteers(volunteersData);
        }, (error) => {
          console.error("사용자 신청 데이터 가져오기 에러:", error);
        });

        // 모든 봉사자 수 실시간 업데이트 (Home과 동일한 로직)
        const allVolunteersQuery = collection(db, "volunteers");
        const unsubscribeAllVolunteers = onSnapshot(allVolunteersQuery, (querySnapshot) => {
          const volunteerCount = {};
          querySnapshot.docs.forEach(doc => {
            const { eventId, volunteerDate } = doc.data();
            if (!eventId) return;
            const dateObj = volunteerDate instanceof Date ? volunteerDate : new Date(volunteerDate);
            const dateKey = dateObj.toISOString().split('T')[0];
            const key = `${eventId}-${dateKey}`;
            volunteerCount[key] = (volunteerCount[key] || 0) + 1;
          });
          setVolunteers(volunteerCount);
        }, (error) => {
          console.error("봉사자 수 업데이트 에러:", error);
        });

        // cleanup
        return () => {
          unsubscribeUserVolunteers();
          unsubscribeAllVolunteers();
        };
      }
    });

    // cleanup
    return () => unsubscribeAuth();
  }, []);

  // 이벤트 세부 정보 가져오기
  useEffect(() => {
    if (userVolunteers.length > 0) {
      userVolunteers.forEach((volunteer) => {
        const eventDocRef = doc(db, "events", volunteer.eventId);
        onSnapshot(eventDocRef, (doc) => {
          if (doc.exists()) {
            setEventDetails(prev => ({
              ...prev,
              [volunteer.eventId]: { id: doc.id, ...doc.data() },
            }));
          }
        }, (error) => {
          console.error("이벤트 세부 정보 가져오기 에러:", error);
        });
      });
    }
  }, [userVolunteers]);

  return (
    <div className="App">
      <h1>나의 신청 현황</h1>
      {currentUser ? (
        <div>
          {userVolunteers.length > 0 ? (
            userVolunteers.map((volunteer) => {
              const event = eventDetails[volunteer.eventId] || {};
              const dateKey = new Date(volunteer.volunteerDate).toISOString().split('T')[0];
              const volunteerKey = `${volunteer.eventId}-${dateKey}`;

              return (
                <div key={volunteer.id} className="post-card" style={{ margin: '10px 0' }}>
                  <h3>신청 정보</h3>
                  <p><strong>이름:</strong> {volunteer.name}</p>
                  <p><strong>봉사 형태:</strong> {event.title || "로딩 중..."}</p>
                  <p><strong>차량 지원 여부:</strong> {volunteer.vehicleSupport === "yes" ? "예" : "아니오"}</p>
                  <p><strong>신청 날짜:</strong> {new Date(volunteer.volunteerDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p><strong>현재 팀원:</strong> {volunteers[volunteerKey] || 0}명</p>
                  <h3>구역 지도</h3>
                  <p>※ 지도 API(예: Google Maps) 통합 필요. 현재는 텍스트로 표시:</p>
                  <p>봉사 구역: {volunteer.eventId === "097DnK97x3dawQQyJBjy" ? "서울시 강남구" :
                    volunteer.eventId === "trnm9Xdjt1ci2FOjIZ24" ? "서울시 종로구" :
                    volunteer.eventId === "0aezcqm32LZhr0XqAFQB" ? "서울시 서초구" : "미정"}</p>
                </div>
              );
            })
          ) : (
            <p>신청 내역이 없습니다.</p>
          )}
        </div>
      ) : (
        <p>로그인 후 확인 가능합니다.</p>
      )}
      <Link to="/">홈으로 돌아가기</Link>
    </div>
  );
}

export default MyPage;