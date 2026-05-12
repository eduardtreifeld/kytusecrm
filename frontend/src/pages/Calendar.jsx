import { useState, useEffect } from 'react';
import { api } from '../services/api';

const WEEKDAYS = ['E', 'T', 'K', 'N', 'R', 'L', 'P'];
const MONTHS = ['Jaanuar','Veebruar','Märts','Aprill','Mai','Juuni','Juuli','August','September','Oktoober','November','Detsember'];

export default function Calendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [events, setEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    api.getCalendar(month, year).then(data => setEvents(data || []));
  }, [month, year]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  // Adjust so Monday = 0
  const startOffset = (firstDay + 6) % 7;

  const eventsByDay = {};
  events.forEach(e => {
    const d = new Date(e.event_date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(e);
  });

  const todayDate = now.getDate();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  return (
    <div className="section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn btn-sm" onClick={prevMonth}>←</button>
        <div style={{ fontWeight: 600 }}>{MONTHS[month - 1]} {year}</div>
        <button className="btn btn-sm" onClick={nextMonth}>→</button>
      </div>

      <div className="cal-header">
        {WEEKDAYS.map(d => <div className="cal-weekday" key={d}>{d}</div>)}
      </div>

      <div className="cal-grid">
        {Array(startOffset).fill(null).map((_, i) => <div key={'e' + i} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && day === todayDate;
          const hasEv = !!eventsByDay[day];
          const isSelected = selectedDay === day;
          return (
            <div
              key={day}
              className={`cal-day${isToday ? ' today' : ''}${hasEv ? ' has-event' : ''}${isSelected ? ' today' : ''}`}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
            >
              <span>{day}</span>
              {hasEv && <div className="event-dot" />}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            {selectedDay}. {MONTHS[month - 1]} — järeltegevused
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13 }}>Sellel päeval pole järeltegevusi.</div>
          ) : selectedEvents.map(e => (
            <div className="card" key={e.id} style={{ padding: '10px 14px' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{e.company_name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{e.contact_name} · {e.title}</div>
              {e.description && <div style={{ fontSize: 12, marginTop: 6, color: '#444' }}>{e.description}</div>}
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && !selectedDay && (
        <div className="empty" style={{ marginTop: 20 }}>
          Sel kuul pole järeltegevusi planeeritud.
        </div>
      )}
    </div>
  );
}
