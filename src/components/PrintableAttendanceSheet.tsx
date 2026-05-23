import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox } from '@mui/material';
import { UserProfile, InstituteSettings } from '../types';
import { format } from 'date-fns';

interface Props {
  students: UserProfile[];
  attendance: Record<string, 'present' | 'absent' | 'late' | 'excused'>;
  selectedDate: Date;
  settings: InstituteSettings | null;
}

const PrintableAttendanceSheet = React.forwardRef<HTMLDivElement, Props>(({ students, attendance, selectedDate, settings }, ref) => {
  return (
    <Box 
      ref={ref} 
      className="a4-print-page"
      sx={{ 
        bgcolor: 'white',
        color: 'black',
        display: 'none',
        '@media print': {
          display: 'block',
        },
      }}
    >
      <Box sx={{ mb: 4, textAlign: 'center', borderBottom: '2px solid black', pb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>{settings?.instituteName || 'AL-ASAR INSTITUTE'}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Daily Attendance Register</Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Date: {format(selectedDate, 'EEEE, d MMMM yyyy')}</Typography>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid black' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black', width: 50 }}>S#</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black' }}>Student Name</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black' }}>ID / Class</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black', textAlign: 'center', width: 80 }}>P</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black', textAlign: 'center', width: 80 }}>A</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black', textAlign: 'center', width: 80 }}>L</TableCell>
              <TableCell sx={{ fontWeight: 900, border: '1px solid black', width: 120 }}>Signature</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((student, index) => (
              <TableRow key={student.uid}>
                <TableCell sx={{ border: '1px solid black' }}>{index + 1}</TableCell>
                <TableCell sx={{ fontWeight: 800, border: '1px solid black' }}>{student.displayName}</TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.75rem' }}>{student.studentId || '-'}<br/>{student.classLevel}</TableCell>
                <TableCell sx={{ border: '1px solid black', textAlign: 'center' }}>
                  {attendance[student.uid] === 'present' ? '✓' : ''}
                </TableCell>
                <TableCell sx={{ border: '1px solid black', textAlign: 'center' }}>
                  {attendance[student.uid] === 'absent' ? '✗' : ''}
                </TableCell>
                <TableCell sx={{ border: '1px solid black', textAlign: 'center' }}>
                  {attendance[student.uid] === 'late' ? 'L' : ''}
                </TableCell>
                <TableCell sx={{ border: '1px solid black' }}></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', px: 2 }}>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>Total Present: {Object.values(attendance).filter(s => s === 'present').length}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>Total Absent: {Object.values(attendance).filter(s => s === 'absent').length}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>Staff Seal & Initials: ____________</Typography>
      </Box>

      <Box sx={{ position: 'absolute', bottom: '15mm', left: '20mm', right: '20mm', pt: 2, borderTop: '1px solid #ddd' }}>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#666' }}>
            Maktab Wali Ul Aser - Knowledge for All.
        </Typography>
      </Box>
    </Box>
  );
});

export default PrintableAttendanceSheet;
