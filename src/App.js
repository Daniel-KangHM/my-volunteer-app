import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './App.css';
import { db, auth } from './firebase';
import { collection, query, orderBy, addDoc, deleteDoc, doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { parseFirestoreDate, formatDate, getDayOfWeek } from './utils/dateUtils';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("로그인 성공!");
    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인 실패: " + error.message);
    }
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setUser(null);
      alert("로그아웃 성공!");
    }).catch((error) => console.error("로그아웃 실패:", error));
  };

  return (
    <div className="login-container">
      {user ? (
        <div className="login-box">
          <h1>환영합니다!</h1>
          <p className="welcome-text">안녕하세요, {user.email}님!</p>
          <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
          <div className="dashboard-buttons">
            <button onClick={() => navigate('/volunteer')}>야외 봉사 신청</button>
            <button onClick={() => navigate('/team-status')}>봉사팀 현황</button>
            {user.email === 'admin@volunteer-app.com' && (
              <button onClick={() => navigate('/admin')}>관리자 페이지</button>
            )}
          </div>
        </div>
      ) : (
        <div className="login-box">
          <h1>로그인</h1>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                required
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
              />
            </div>
            <button type="submit" className="login-btn">로그인</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Volunteer() {
  const [events, setEvents] = useState([]);
  const [volunteers, setVolunteers] = useState({});
  const [formData, setFormData] = useState({ name: '', vehicle: 'no', eventId: null });

  useEffect(() => {
    const eventsQuery = query(collection(db, "events"), orderBy("date"));
    const unsubscribeEvents = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      const sortedEvents = eventsData.sort((a, b) => {
        const order = { houseVisit: 1, publicEvidence: 2, various: 3 };
        return order[a.type] - order[b.type];
      });
      setEvents(sortedEvents);
    }, (error) => {
      console.error("events 실시간 업데이트 에러:", error);
    });

    const volunteersQuery = collection(db, "volunteers");
    const unsubscribeVolunteers = onSnapshot(volunteersQuery, (querySnapshot) => {
      const volunteerCount = {};
      querySnapshot.docs.forEach(doc => {
        const { eventId, volunteerDate } = doc.data();
        if (!eventId) {
          console.error("eventId가 누락된 신청 데이터:", doc.data());
          return;
        }
        const dateObj = parseFirestoreDate(volunteerDate);
        if (!dateObj || isNaN(dateObj.getTime())) {
          console.error("날짜 파싱 실패:", volunteerDate);
          return;
        }
        const dateKey = dateObj.toISOString().split('T')[0];
        const key = `${eventId}-${dateKey}`;
        volunteerCount[key] = (volunteerCount[key] || 0) + 1;
      });
      setVolunteers(volunteerCount);
    }, (error) => {
      console.error("volunteers 실시간 업데이트 에러:", error);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeVolunteers();
    };
  }, []);

  const handleSubmit = async (eventId) => {
    if (!formData.name) {
      alert("이름을 입력해주세요.");
      return;
    }
    try {
      const event = events.find(e => e.id === eventId);
      const eventDate = parseFirestoreDate(event.date);
      if (!eventDate || isNaN(eventDate.getTime())) {
        throw new Error("잘못된 날짜 형식입니다.");
      }

      const docRef = await addDoc(collection(db, "volunteers"), {
        name: formData.name,
        vehicleSupport: formData.vehicle,
        volunteerDate: eventDate.toISOString(),
        eventId: eventId,
        timestamp: new Date().toISOString(),
      });
      console.log("신청 완료됨. ID:", docRef.id);

      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, {
        currentPeople: increment(1),
      });

      alert("신청이 완료되었습니다!");
      setFormData({ name: '', vehicle: 'no', eventId: null });
    } catch (error) {
      console.error("에러:", error);
      alert("신청 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

    return (
      <div className="App">
        <h1>야외 봉사 신청</h1>
        <div className="post-list">
          {events.map(event => {
            const eventDate = parseFirestoreDate(event.date);
            if (!eventDate || isNaN(eventDate.getTime())) {
              console.error("날짜 파싱 실패:", event.date);
              return null;
            }
            const dateStr = formatDate(eventDate);
            const dayOfWeek = getDayOfWeek(eventDate);
            const dateKey = eventDate.toISOString().split('T')[0];
            const volunteerKey = `${event.id}-${dateKey}`;
            const currentPeople = volunteers[volunteerKey] || 0;
            const isClosed = currentPeople >= event.people; // 마감 여부 체크
  
            return (
              <div key={event.id} className="post-card">
                <h3>{event.title} {isClosed && <span className="closed-label">(마감)</span>}</h3>
                <p>날짜: {`${dateStr} (${dayOfWeek})`}</p>
                <p>최대 신청 인원: {event.people}명 (현재 신청 인원: {currentPeople}명)</p>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!isClosed) handleSubmit(event.id); // 마감 아니면 제출
                }}>
                  <div>
                    <label>이름: </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value, eventId: event.id })}
                      placeholder="이름 입력"
                      disabled={isClosed} // 마감 시 입력 비활성화
                    />
                  </div>
                  <div>
                    <label>차량 지원 여부: </label>
                    <select
                      value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value, eventId: event.id })}
                      disabled={isClosed} // 마감 시 선택 비활성화
                    >
                      <option value="yes">예</option>
                      <option value="no">아니오</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className={isClosed ? "closed-btn" : "submit-btn"}
                    disabled={isClosed}
                    style={{ backgroundColor: event.type === "houseVisit" ? "#007bff" : event.type === "publicEvidence" ? "#BA55D3" : "#007bff" }}
                  >
                    {isClosed ? "마감" : "신청"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
        <Link to="/inquiry">문의하기</Link>
        <button className="back-btn" onClick={() => window.history.back()}>뒤로 가기</button>
      </div>
    );
  }

function Apply() {
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState('no');
  const [date, setDate] = useState(new Date());

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "volunteers"), {
        name: name,
        vehicleSupport: vehicle,
        volunteerDate: date.toISOString(),
        timestamp: new Date().toISOString(),
      });
      console.log("문서 작성됨. ID:", docRef.id);
      setName('');
      setVehicle('no');
      setDate(new Date());
    } catch (error) {
      console.error("에러:", error);
    }
  };

  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 13);

  return (
    <div className="App">
      <h1>봉사 신청</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>이름: </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label>차량 지원 여부: </label>
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="yes">예</option>
            <option value="no">아니오</option>
          </select>
        </div>
        <div>
          <label>봉사 날짜: </label>
          <Calendar
            onChange={setDate}
            value={date}
            minDate={today}
            maxDate={maxDate}
          />
        </div>
        <button type="submit">신청 완료</button>
      </form>
    </div>
  );
}

function Inquiry() {
  const [formData, setFormData] = useState({ userName: '', question: '' });
  const [inquiries, setInquiries] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "inquiries"), {
        userName: formData.userName,
        question: formData.question,
        timestamp: new Date().toISOString(),
        answer: null,
        answeredBy: null,
      });
      console.log("문의가 제출되었습니다.");
      setFormData({ userName: '', question: '' });
      alert("문의가 제출되었습니다!");
    } catch (error) {
      console.error("문의 제출 에러:", error);
      alert("문의 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  useEffect(() => {
    const inquiriesQuery = query(collection(db, "inquiries"), orderBy("timestamp", "desc"));
    const unsubscribeInquiries = onSnapshot(inquiriesQuery, (querySnapshot) => {
      const inquiriesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInquiries(inquiriesData);
    }, (error) => {
      console.error("inquiries 실시간 업데이트 에러:", error);
    });

    return () => unsubscribeInquiries();
  }, []);

  return (
    <div className="App">
      <h1>문의하기</h1>
      <form onSubmit={handleSubmit} className="post-card">
        <div>
          <label>이름: </label>
          <input
            type="text"
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            placeholder="이름 입력"
          />
        </div>
        <div>
          <label>문의 내용: </label>
          <textarea
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            placeholder="문의 내용을 입력하세요"
            rows="4"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <button type="submit" style={{ backgroundColor: "#007bff", color: "white" }}>제출</button>
      </form>

      <h2>문의 목록</h2>
      <div>
        {inquiries.map(inquiry => (
          <div key={inquiry.id} className="post-card" style={{ margin: '10px 0' }}>
            <p><strong>이름:</strong> {inquiry.userName}</p>
            <p><strong>문의 내용:</strong> {inquiry.question}</p>
            <p><strong>시간:</strong> {new Date(inquiry.timestamp).toLocaleString('ko-KR')}</p>
            {inquiry.answer && (
              <p><strong>답변:</strong> {inquiry.answer} (by {inquiry.answeredBy})</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("현재 사용자:", currentUser);
      if (currentUser && currentUser.email === 'admin@volunteer-app.com') {
        onLogin(true);
        navigate('/admin');
      } else if (currentUser) {
        console.log("비관리자 사용자 감지:", currentUser.email);
        alert("관리자 계정만 접근 가능합니다.");
        signOut(auth).then(() => navigate('/'));
      }
    });
    return () => unsubscribe();
  }, [onLogin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("로그인 시도 사용자:", userCredential.user);
      if (userCredential.user.email === 'admin@volunteer-app.com') {
        onLogin(true);
        navigate('/admin');
      } else {
        alert("관리자 계정만 접근 가능합니다.");
        await signOut(auth);
        navigate('/');
      }
    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인 실패. 이메일과 비밀번호를 확인하세요. 에러: " + error.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>관리자 로그인</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="관리자 이메일"
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
            />
          </div>
          <button type="submit" className="login-btn">로그인</button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ isLoggedIn, setIsLoggedIn }) {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', date: new Date(), type: 'houseVisit', people: 0, repeat: 'none' });
  const [editingEvent, setEditingEvent] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: '', area: '', volunteers: [], type: 'houseVisit' });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEventList, setShowEventList] = useState(false);
  const [showInquiryList, setShowInquiryList] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);

  useEffect(() => {
    // 이벤트 데이터 가져오기
    const eventsQuery = query(collection(db, "events"), orderBy("date"));
    const unsubscribeEvents = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedEvents = eventsData.sort((a, b) => {
        const order = { houseVisit: 1, publicEvidence: 2, various: 3 };
        return order[a.type] - order[b.type];
      });
      setEvents(sortedEvents);
    }, (error) => console.error("events 실시간 업데이트 에러:", error));

    // 문의 데이터 가져오기
    const inquiriesQuery = query(collection(db, "inquiries"), orderBy("timestamp", "desc"));
    const unsubscribeInquiries = onSnapshot(inquiriesQuery, (querySnapshot) => {
      const inquiriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInquiries(inquiriesData);
    }, (error) => console.error("inquiries 실시간 업데이트 에러:", error));

    // 봉사자 데이터 가져오기
    const volunteersQuery = query(collection(db, "volunteers"), orderBy("timestamp"));
    const unsubscribeVolunteers = onSnapshot(volunteersQuery, (snapshot) => {
      setVolunteers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("봉사자 데이터 가져오기 오류:", error));

    // 팀 데이터 가져오기
    const teamsQuery = query(collection(db, "teams"));
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("팀 데이터 가져오기 오류:", error));

    return () => {
      unsubscribeEvents();
      unsubscribeInquiries();
      unsubscribeVolunteers();
      unsubscribeTeams();
    };
  }, []);

  // 새 이벤트 추가
  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      const eventDate = parseFirestoreDate(newEvent.date);
      if (!eventDate || isNaN(eventDate.getTime())) throw new Error("잘못된 날짜 형식입니다.");
      const docRef = await addDoc(collection(db, "events"), {
        title: newEvent.title,
        date: eventDate.toISOString(),
        type: newEvent.type,
        people: Number(newEvent.people),
        repeat: newEvent.repeat,
        currentPeople: 0,
      });
      console.log("새 공고 추가됨. ID:", docRef.id);
      setNewEvent({ title: '', date: new Date(), type: 'houseVisit', people: 0, repeat: 'none' });
    } catch (error) {
      console.error("에러:", error);
    }
  };

  // 이벤트 수정 시작
  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      date: parseFirestoreDate(event.date),
      type: event.type,
      people: event.people,
      repeat: event.repeat || 'none',
    });
  };

  // 이벤트 업데이트
  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    try {
      const eventDate = parseFirestoreDate(newEvent.date);
      if (!eventDate || isNaN(eventDate.getTime())) throw new Error("잘못된 날짜 형식입니다.");
      await updateDoc(doc(db, "events", editingEvent.id), {
        title: newEvent.title,
        date: eventDate.toISOString(),
        type: newEvent.type,
        people: Number(newEvent.people),
        repeat: newEvent.repeat,
      });
      console.log("공고 업데이트됨. ID:", editingEvent.id);
      setEditingEvent(null);
      setNewEvent({ title: '', date: new Date(), type: 'houseVisit', people: 0, repeat: 'none' });
    } catch (error) {
      console.error("에러:", error);
    }
  };

  // 이벤트 삭제
  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteDoc(doc(db, "events", eventId));
      console.log("공고 삭제됨. ID:", eventId);
    } catch (error) {
      console.error("에러:", error);
    }
  };

  // 문의 답변
  const handleAnswerInquiry = async (inquiryId, answer) => {
    try {
      const inquiryRef = doc(db, "inquiries", inquiryId);
      await updateDoc(inquiryRef, {
        answer: answer,
        answeredBy: auth.currentUser?.email || "관리자",
        timestamp: new Date().toISOString(),
      });
      console.log("문의 답변 완료됨. ID:", inquiryId);
    } catch (error) {
      console.error("문의 답변 에러:", error);
      alert("답변 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  // 새 팀 추가
  const handleAddTeam = async (e) => {
    e.preventDefault();
    try {
      const teamData = {
        name: newTeam.name,
        area: newTeam.area,
        volunteers: newTeam.volunteers,
        type: newTeam.type,
        vehicleSupportCount: newTeam.volunteers.filter(v => v.vehicleSupport === "yes").length,
      };
      await addDoc(collection(db, "teams"), teamData);
      setNewTeam({ name: '', area: '', volunteers: [], type: 'houseVisit' });
    } catch (error) {
      console.error("팀 추가 오류:", error);
    }
  };

  // 팀 수정
  const handleUpdateTeam = async (teamId, updatedData) => {
    try {
      await updateDoc(doc(db, "teams", teamId), updatedData);
    } catch (error) {
      console.error("팀 수정 오류:", error);
    }
  };

  // 팀 삭제
  const handleDeleteTeam = async (teamId) => {
    try {
      await deleteDoc(doc(db, "teams", teamId));
    } catch (error) {
      console.error("팀 삭제 오류:", error);
    }
  };

  // 팀원 제외
  const handleRemoveVolunteer = async (teamId, volunteerId) => {
    const team = teams.find(t => t.id === teamId);
    const updatedVolunteers = team.volunteers.filter(v => v.id !== volunteerId);
    const updatedData = {
      volunteers: updatedVolunteers,
      vehicleSupportCount: updatedVolunteers.filter(v => v.vehicleSupport === "yes").length,
    };
    await handleUpdateTeam(teamId, updatedData);
  };

  // 팀원 이동
  const handleMoveVolunteer = async (fromTeamId, toTeamId, volunteerId) => {
    const fromTeam = teams.find(t => t.id === fromTeamId);
    const toTeam = teams.find(t => t.id === toTeamId);
    const volunteer = fromTeam.volunteers.find(v => v.id === volunteerId);
    const updatedFromVolunteers = fromTeam.volunteers.filter(v => v.id !== volunteerId);
    const updatedToVolunteers = [...toTeam.volunteers, volunteer];

    await handleUpdateTeam(fromTeamId, {
      volunteers: updatedFromVolunteers,
      vehicleSupportCount: updatedFromVolunteers.filter(v => v.vehicleSupport === "yes").length,
    });
    await handleUpdateTeam(toTeamId, {
      volunteers: updatedToVolunteers,
      vehicleSupportCount: updatedToVolunteers.filter(v => v.vehicleSupport === "yes").length,
    });
  };

  // 로그아웃 함수 추가!!!
  const handleLogout = () => {
    signOut(auth).then(() => {
      setIsLoggedIn(false);
      console.log("로그아웃 성공");
    }).catch((error) => console.error("로그아웃 실패:", error));
  };

  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;

  // 봉사 형태별 봉사자 분리
  const volunteerTypes = {
    houseVisit: volunteers.filter(v => v.eventId && events.find(e => e.id === v.eventId)?.type === "houseVisit"),
    publicEvidence: volunteers.filter(v => v.eventId && events.find(e => e.id === v.eventId)?.type === "publicEvidence"),
    various: volunteers.filter(v => v.eventId && events.find(e => e.id === v.eventId)?.type === "various"),
  };

  // 봉사 형태별 팀 분리
  const teamTypes = {
    houseVisit: teams.filter(t => t.type === "houseVisit"),
    publicEvidence: teams.filter(t => t.type === "publicEvidence"),
    various: teams.filter(t => t.type === "various"),
  };

  return (
    <div className="App">
      <h1>관리자 대시보드</h1>
      <button onClick={handleLogout}>로그아웃</button>

      {/* 새 공고 추가 섹션 */}
      <div className="admin-section admin-add-event">
        <h2 onClick={() => setShowAddEvent(!showAddEvent)}>
          새 공고 추가 {showAddEvent ? "▼" : "▶"}
        </h2>
        <div className={`content ${showAddEvent ? 'expanded' : 'collapsed'}`}>
          {showAddEvent && (
            <form onSubmit={handleAddEvent} className="admin-form">
              <div>
                <label>제목: </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>
              <div>
                <label>날짜: </label>
                <input
                  type="date"
                  value={newEvent.date.toISOString().split('T')[0]}
                  onChange={(e) => setNewEvent({ ...newEvent, date: new Date(e.target.value) })}
                />
              </div>
              <div>
                <label>형태: </label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                >
                  <option value="houseVisit">호별 방문</option>
                  <option value="publicEvidence">공개 증거(전시대)</option>
                  <option value="various">다양한 형태의 봉사</option>
                </select>
              </div>
              <div>
                <label>인원: </label>
                <input
                  type="number"
                  value={newEvent.people}
                  onChange={(e) => setNewEvent({ ...newEvent, people: e.target.value })}
                />
              </div>
              <div>
                <label>반복: </label>
                <select
                  value={newEvent.repeat}
                  onChange={(e) => setNewEvent({ ...newEvent, repeat: e.target.value })}
                >
                  <option value="none">없음</option>
                  <option value="weekly">매주</option>
                </select>
              </div>
              <button type="submit">추가</button>
            </form>
          )}
        </div>
      </div>

      {/* 기존 공고 목록 섹션 */}
      <div className="admin-section admin-event-list">
        <h2 onClick={() => setShowEventList(!showEventList)}>
          기존 공고 목록 {showEventList ? "▼" : "▶"}
        </h2>
        <div className={`content ${showEventList ? 'expanded' : 'collapsed'}`}>
          {showEventList && (
            <div>
              {events.map(event => {
                const eventDate = parseFirestoreDate(event.date);
                const isClosed = event.currentPeople >= event.people;
                return (
                  <div key={event.id} className="post-card" style={{ margin: '10px 0' }}>
                    <h3>{event.title} {isClosed && <span className="closed-label">(마감)</span>}</h3>
                    <p>날짜: {formatDate(eventDate)}</p>
                    <p>형태: {event.type === "houseVisit" ? "호별 방문" : event.type === "publicEvidence" ? "공개 증거(전시대)" : "다양한 형태의 봉사"}</p>
                    <p>인원: {event.currentPeople}/{event.people}명</p>
                    <p>반복: {event.repeat || "없음"}</p>
                    {editingEvent?.id === event.id ? (
                      <form onSubmit={handleUpdateEvent}>
                        <input
                          type="text"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        />
                        <input
                          type="date"
                          value={newEvent.date.toISOString().split('T')[0]}
                          onChange={(e) => setNewEvent({ ...newEvent, date: new Date(e.target.value) })}
                        />
                        <select
                          value={newEvent.type}
                          onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                        >
                          <option value="houseVisit">호별 방문</option>
                          <option value="publicEvidence">공개 증거(전시대)</option>
                          <option value="various">다양한 형태의 봉사</option>
                        </select>
                        <input
                          type="number"
                          value={newEvent.people}
                          onChange={(e) => setNewEvent({ ...newEvent, people: e.target.value })}
                        />
                        <select
                          value={newEvent.repeat}
                          onChange={(e) => setNewEvent({ ...newEvent, repeat: e.target.value })}
                        >
                          <option value="none">없음</option>
                          <option value="weekly">매주</option>
                        </select>
                        <button type="submit">업데이트</button>
                        <button onClick={() => setEditingEvent(null)}>취소</button>
                      </form>
                    ) : (
                      <>
                        <button className="edit-btn" onClick={() => handleEditEvent(event)}>수정</button>
                        <button className="delete-btn" onClick={() => handleDeleteEvent(event.id)}>삭제</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 문의 목록 섹션 */}
      <div className="admin-section admin-inquiry-list">
        <h2 onClick={() => setShowInquiryList(!showInquiryList)}>
          문의 목록 {showInquiryList ? "▼" : "▶"}
        </h2>
        <div className={`content ${showInquiryList ? 'expanded' : 'collapsed'}`}>
          {showInquiryList && (
            <div>
              {inquiries.map(inquiry => (
                <div key={inquiry.id} className="post-card" style={{ margin: '10px 0' }}>
                  <p><strong>이름:</strong> {inquiry.userName}</p>
                  <p><strong>문의 내용:</strong> {inquiry.question}</p>
                  <p><strong>시간:</strong> {new Date(inquiry.timestamp).toLocaleString('ko-KR')}</p>
                  {inquiry.answer ? (
                    <p><strong>답변:</strong> {inquiry.answer} (by {inquiry.answeredBy})</p>
                  ) : (
                    <div>
                      <input
                        type="text"
                        placeholder="답변 입력"
                        onChange={(e) => handleAnswerInquiry(inquiry.id, e.target.value)}
                      />
                      <button onClick={() => handleAnswerInquiry(inquiry.id, prompt("답변을 입력하세요"))}>답변 제출</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 팀 관리 섹션 */}
      <div className="admin-section admin-team-management">
        <h2 onClick={() => setShowTeamManagement(!showTeamManagement)}>
          팀 관리 {showTeamManagement ? "▼" : "▶"}
        </h2>
        <div className={`content ${showTeamManagement ? 'expanded' : 'collapsed'}`}>
          {showTeamManagement && (
            <>
              <h3>새 팀 추가</h3>
              <form onSubmit={handleAddTeam} className="admin-form">
                <div>
                  <label>팀 이름: </label>
                  <input
                    type="text"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    placeholder="팀 이름 입력"
                  />
                </div>
                <div>
                  <label>구역: </label>
                  <input
                    type="text"
                    value={newTeam.area}
                    onChange={(e) => setNewTeam({ ...newTeam, area: e.target.value })}
                    placeholder="구역 입력"
                  />
                </div>
                <div>
                  <label>봉사 형태: </label>
                  <select
                    value={newTeam.type}
                    onChange={(e) => setNewTeam({ ...newTeam, type: e.target.value })}
                  >
                    <option value="houseVisit">호별 방문</option>
                    <option value="publicEvidence">공개 증거(전시대)</option>
                    <option value="various">다양한 형태의 봉사</option>
                  </select>
                </div>
                <div>
                  <label>봉사자 선택: </label>
                  <div className="checkbox-list">
                    {volunteerTypes[newTeam.type].map(volunteer => (
                      <label key={volunteer.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={newTeam.volunteers.some(v => v.id === volunteer.id)}
                          onChange={(e) => {
                            const updatedVolunteers = e.target.checked
                              ? [...newTeam.volunteers, volunteer]
                              : newTeam.volunteers.filter(v => v.id !== volunteer.id);
                            setNewTeam({ ...newTeam, volunteers: updatedVolunteers });
                          }}
                        />
                        {volunteer.name} {volunteer.vehicleSupport === "yes" ? "(차량)" : ""}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit">팀 추가</button>
              </form>

              <h3>호별 방문 팀</h3>
              <div className="team-list">
                {teamTypes.houseVisit.map(team => (
                  <div key={team.id} className="team-card">
                    <h3>{team.name}</h3>
                    <span className="team-area">구역: 
                      <input
                        type="text"
                        value={team.area || ''}
                        onChange={(e) => {
                          const updatedTeams = teams.map(t =>
                            t.id === team.id ? { ...t, area: e.target.value } : t
                          );
                          setTeams(updatedTeams);
                        }}
                        onBlur={() => handleUpdateTeam(team.id, { area: team.area })}
                        placeholder="구역 입력"
                      />
                    </span>
                    <div className="team-volunteers">
                      {team.volunteers.map(volunteer => (
                        <span key={volunteer.id} className="volunteer-name">
                          {volunteer.name}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value === "remove") {
                                handleRemoveVolunteer(team.id, volunteer.id);
                              } else if (e.target.value) {
                                handleMoveVolunteer(team.id, e.target.value, volunteer.id);
                              }
                            }}
                          >
                            <option value="">동작 선택</option>
                            <option value="remove">제외</option>
                            {teams.filter(t => t.id !== team.id).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </span>
                      ))}
                    </div>
                    <p>차량 지원: {team.vehicleSupportCount || 0}명</p>
                    <button className="delete-btn" onClick={() => handleDeleteTeam(team.id)}>팀 삭제</button>
                  </div>
                ))}
              </div>

              <h3>공개 증거(전시대) 팀</h3>
              <div className="team-list">
                {teamTypes.publicEvidence.map(team => (
                  <div key={team.id} className="team-card">
                    <h3>{team.name}</h3>
                    <span className="team-area">구역: 
                      <input
                        type="text"
                        value={team.area || ''}
                        onChange={(e) => {
                          const updatedTeams = teams.map(t =>
                            t.id === team.id ? { ...t, area: e.target.value } : t
                          );
                          setTeams(updatedTeams);
                        }}
                        onBlur={() => handleUpdateTeam(team.id, { area: team.area })}
                        placeholder="구역 입력"
                      />
                    </span>
                    <div className="team-volunteers">
                      {team.volunteers.map(volunteer => (
                        <span key={volunteer.id} className="volunteer-name">
                          {volunteer.name}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value === "remove") {
                                handleRemoveVolunteer(team.id, volunteer.id);
                              } else if (e.target.value) {
                                handleMoveVolunteer(team.id, e.target.value, volunteer.id);
                              }
                            }}
                          >
                            <option value="">동작 선택</option>
                            <option value="remove">제외</option>
                            {teams.filter(t => t.id !== team.id).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </span>
                      ))}
                    </div>
                    <p>차량 지원: {team.vehicleSupportCount || 0}명</p>
                    <button className="delete-btn" onClick={() => handleDeleteTeam(team.id)}>팀 삭제</button>
                  </div>
                ))}
              </div>

              <h3>다양한 형태의 봉사 팀</h3>
              <div className="team-list">
                {teamTypes.various.map(team => (
                  <div key={team.id} className="team-card">
                    <h3>{team.name}</h3>
                    <span className="team-area">구역: 
                      <input
                        type="text"
                        value={team.area || ''}
                        onChange={(e) => {
                          const updatedTeams = teams.map(t =>
                            t.id === team.id ? { ...t, area: e.target.value } : t
                          );
                          setTeams(updatedTeams);
                        }}
                        onBlur={() => handleUpdateTeam(team.id, { area: team.area })}
                        placeholder="구역 입력"
                      />
                    </span>
                    <div className="team-volunteers">
                      {team.volunteers.map(volunteer => (
                        <span key={volunteer.id} className="volunteer-name">
                          {volunteer.name}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value === "remove") {
                                handleRemoveVolunteer(team.id, volunteer.id);
                              } else if (e.target.value) {
                                handleMoveVolunteer(team.id, e.target.value, volunteer.id);
                              }
                            }}
                          >
                            <option value="">동작 선택</option>
                            <option value="remove">제외</option>
                            {teams.filter(t => t.id !== team.id).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </span>
                      ))}
                    </div>
                    <p>차량 지원: {team.vehicleSupportCount || 0}명</p>
                    <button className="delete-btn" onClick={() => handleDeleteTeam(team.id)}>팀 삭제</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <button className="back-btn" onClick={() => window.history.back()}>뒤로 가기</button>
    </div>
  );
}
function TeamStatus() {
    const [volunteers, setVolunteers] = useState([]);
    const [teams, setTeams] = useState([]);
    const navigate = useNavigate();
  
    useEffect(() => {
      // 봉사자 데이터 가져오기
      const volunteersQuery = query(collection(db, "volunteers"), orderBy("timestamp"));
      const unsubscribeVolunteers = onSnapshot(volunteersQuery, (snapshot) => {
        const volunteerData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVolunteers(volunteerData);
      }, (error) => {
        console.error("봉사자 데이터 가져오기 오류:", error);
      });
  
      // 팀 데이터 가져오기 (없으면 빈 배열)
      const teamsQuery = query(collection(db, "teams"));
      const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
        const teamData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeams(teamData);
      }, (error) => {
        console.error("팀 데이터 가져오기 오류:", error);
      });
  
      return () => {
        unsubscribeVolunteers();
        unsubscribeTeams();
      };
    }, []);
  
    return (
      <div className="App">
        <h1>봉사팀 현황</h1>
        <div className="team-status">
          <h2>봉사자 목록</h2>
          {volunteers.length === 0 ? (
            <p>아직 신청한 봉사자가 없습니다.</p>
          ) : (
            <ul className="volunteer-list">
              {volunteers.map(volunteer => (
                <li key={volunteer.id} className="volunteer-item">
                  <span>{volunteer.name}</span>
                  <span>차량 지원: {volunteer.vehicleSupport === "yes" ? "예" : "아니오"}</span>
                  <span>이벤트 ID: {volunteer.eventId}</span>
                  <span>신청 날짜: {formatDate(volunteer.volunteerDate)}</span>
                </li>
              ))}
            </ul>
          )}
  
          <h2>팀 목록</h2>
          {teams.length === 0 ? (
            <p>아직 팀이 구성되지 않았습니다.</p>
          ) : (
            <div className="team-list">
              {teams.map(team => (
                <div key={team.id} className="team-card">
                  <h3>{team.name}</h3>
                  <p>구역: {team.area || "미정"}</p>
                  <p>차량 지원: {team.vehicleSupportCount || 0}명</p>
                  <p>팀원: {team.volunteers ? team.volunteers.length : 0}명</p>
                  <ul>
                    {team.volunteers && team.volunteers.map(v => (
                      <li key={v.id}>{v.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="back-btn" onClick={() => navigate('/')}>뒤로 가기</button>
      </div>
    );
  }

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("App 컴포넌트 - 현재 사용자:", currentUser);
      if (currentUser && currentUser.email === 'admin@volunteer-app.com') {
        setIsAdminLoggedIn(true);
        console.log("App - 관리자 로그인 상태 설정됨, isAdminLoggedIn:", true);
      } else {
        setIsAdminLoggedIn(false);
        console.log("App - 비관리자 또는 로그아웃 상태, isAdminLoggedIn:", false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/team-status" element={<TeamStatus />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/inquiry" element={<Inquiry />} />
        <Route path="/admin/login" element={<AdminLogin onLogin={(loggedIn) => {
          setIsAdminLoggedIn(loggedIn);
          console.log("onLogin 호출됨, isAdminLoggedIn:", loggedIn);
        }} />} />
        <Route path="/admin" element={isAdminLoggedIn ? <AdminDashboard isLoggedIn={isAdminLoggedIn} setIsLoggedIn={setIsAdminLoggedIn} /> : <Navigate to="/admin/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;