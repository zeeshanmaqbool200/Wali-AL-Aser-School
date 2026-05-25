import React, { useState, useMemo, useEffect } from 'react';
import { Box, Grid, Card, Typography, Button, Avatar, IconButton, TextField, InputAdornment, Stack, useTheme, Skeleton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, alpha } from '@mui/material';
import { Search, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Save, Check, X, FileText } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, Timestamp, writeBatch } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';
import PrintableAttendanceSheet from '../components/PrintableAttendanceSheet';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';

const Attendance = () => {
  const theme = useTheme();
  const { users, attendance, loading: dataLoading, setIsSaving, isSaving } = useData();
  const { user: currentUser, instituteSettings } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAttendance, setCurrentAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Attendance_${format(selectedDate, 'yyyy-MM-dd')}`,
  });

  const students = useMemo(() => {
    return users.filter(u => (u.role === 'student' || !u.role) && u.status !== 'Archived' && 
      (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.admissionNo?.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [users, searchQuery]);

  useEffect(() => {
    const dayStart = startOfDay(selectedDate).getTime();
    const dayEnd = endOfDay(selectedDate).getTime();
    const records = attendance.filter(a => {
      const recordDate = a.date instanceof Timestamp ? a.date.toMillis() : a.date;
      return recordDate >= dayStart && recordDate <= dayEnd;
    });
    const newMap: Record<string, any> = {};
    records.forEach(r => { if (r.studentId) newMap[r.studentId] = r.status; });
    setCurrentAttendance(newMap);
  }, [attendance, selectedDate]);

  const handleSaveAttendance = async () => {
    setSaveConfirmOpen(false);
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const dateId = format(selectedDate, 'yyyy-MM-dd');
      Object.entries(currentAttendance).forEach(([studentId, status]) => {
        const ref = doc(db, 'attendance', `${studentId}_${dateId}`);
        batch.set(ref, { studentId, date: Timestamp.fromDate(selectedDate), status, markedBy: currentUser?.uid, updatedAt: Timestamp.now() }, { merge: true });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (dataLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 4, m: 2 }} />;

  return (
    <Box sx={{ pb: 16, pt: 2 }}>
      <PrintableAttendanceSheet 
        ref={printRef} 
        students={students} 
        attendance={currentAttendance} 
        selectedDate={selectedDate} 
        settings={instituteSettings} 
      />
      <ConfirmDialog isOpen={saveConfirmOpen} title="Save Attendance?" message={`Submit records for ${format(selectedDate, 'dd-MM-yyyy')}?`} onConfirm={handleSaveAttendance} onCancel={() => setSaveConfirmOpen(false)} isDestructive={false} />
      <Stack spacing={3} sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box><Typography variant="h5" sx={{ fontWeight: 950 }}>Attendance</Typography></Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Printer size={18} />} onClick={() => handlePrint()} sx={{ display: { xs: 'none', sm: 'flex' } }}>Print Sheet</Button>
            <Button variant="contained" startIcon={<Save size={18} />} onClick={() => setSaveConfirmOpen(true)} disabled={isSaving}>Submit Records</Button>
          </Stack>
        </Box>
        <Paper sx={{ p: 2, borderRadius: 4, display: 'flex', gap: 2, alignItems: 'center', border: '1px solid', borderColor: 'divider' }}>
          <IconButton onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}><ChevronLeft /></IconButton>
          <Typography sx={{ fontWeight: 900, flex: 1, textAlign: 'center' }}>{format(selectedDate, 'EEEE, d MMM yyyy')}</Typography>
          <IconButton onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}><ChevronRight /></IconButton>
          <TextField size="small" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <Search size={18} /> }} />
        </Paper>
        <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 500 }}><TableHead><TableRow><TableCell>Student</TableCell><TableCell align="center">Action</TableCell></TableRow></TableHead>
            <TableBody>{students.map(s => (
              <TableRow key={s.uid} hover><TableCell><Stack direction="row" spacing={2} alignItems="center"><Avatar src={s.photoURL} />
                <Box><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{s.displayName}</Typography><Typography variant="caption">{s.classLevel}</Typography></Box></Stack></TableCell>
                <TableCell align="center"><Stack direction="row" spacing={1} justifyContent="center">{['present', 'absent', 'late'].map(st => (
                    <Box key={st} onClick={() => setCurrentAttendance(p => ({ ...p, [s.uid]: st as any }))} sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid', borderColor: currentAttendance[s.uid] === st ? 'primary.main' : 'divider', bgcolor: currentAttendance[s.uid] === st ? alpha(theme.palette.primary.main, 0.1) : 'transparent' }}>
                      {st === 'present' ? <Check size={18} /> : st === 'absent' ? <X size={18} /> : <Clock size={14} />}
                    </Box>))}</Stack></TableCell></TableRow>))}</TableBody></Table>
        </TableContainer>
      </Stack>
    </Box>
  );
};

export default Attendance;
