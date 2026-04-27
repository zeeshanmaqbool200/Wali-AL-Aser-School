import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, Paper, CircularProgress, alpha, useTheme, Avatar, Divider, Button } from '@mui/material';
import { ShieldCheck, Calendar, User, BookOpen, Clock, CheckCircle, Smartphone } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';

export default function Verify() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const theme = useTheme();

  useEffect(() => {
    async function verifyData() {
      if (!id || !type) return;
      try {
        const collectionName = type === 'receipt' ? 'receipts' : 'users';
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
      } catch (error) {
        console.error("Verification error:", error);
      } finally {
        setLoading(false);
      }
    }
    verifyData();
  }, [id, type]);

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h4" color="error" gutterBottom>Verification Failed</Typography>
        <Typography variant="body1">This document could not be verified. It may be invalid or expired.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'background.default' }}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <Paper sx={{ 
          p: 4, 
          maxWidth: 500, 
          width: '100%', 
          borderRadius: 8, 
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              bgcolor: alpha(theme.palette.success.main, 0.1), 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'success.main'
            }}>
              <ShieldCheck size={48} />
            </Box>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Official Verification</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
            This document is authentic and verified by Al-Maktab Al-Wasati System.
          </Typography>

          <Divider sx={{ mb: 4 }} />

          {type === 'receipt' ? (
            <Box sx={{ textAlign: 'left' }}>
              <DataRow label="Student Name" value={data.studentName} icon={<User size={18} />} />
              <DataRow label="Receipt No" value={data.receiptNo || data.receiptNumber || 'N/A'} icon={<Smartphone size={18} />} />
              <DataRow label="Amount Paid" value={`₹${data.amount}`} icon={<BookOpen size={18} />} />
              <DataRow label="Fee Head" value={data.feeHead} icon={<ShieldCheck size={18} />} />
              <DataRow label="Date of Payment" value={data.date} icon={<Clock size={18} />} />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'left' }}>
              <DataRow label="Name" value={data.displayName} icon={<User size={18} />} />
              <DataRow label="ID / Admission #" value={data.admissionNo || data.teacherId || 'N/A'} icon={<ShieldCheck size={18} />} />
              <DataRow label="Grade / Level" value={data.maktabLevel || data.grade || data.subject || 'Standard'} icon={<BookOpen size={18} />} />
              <DataRow label="Role" value={data.role?.toUpperCase() || 'N/A'} icon={<User size={18} />} />
              <DataRow label="Join Date" value={data.admissionDate || data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'} icon={<Calendar size={18} />} />
            </Box>
          )}

          <Box sx={{ mt: 4, p: 2, borderRadius: 4, bgcolor: alpha(theme.palette.success.main, 0.05), display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
            <CheckCircle size={20} className="text-success-500" />
            <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 900 }}>VERIFIED DOCUMENT</Typography>
          </Box>

          <Typography variant="caption" sx={{ mt: 4, display: 'block', color: 'text.disabled' }}>
            Verification Date: {new Date().toLocaleString()}
          </Typography>
        </Paper>
      </motion.div>
    </Box>
  );
}

function DataRow({ label, value, icon }: { label: string, value: string, icon: any }) {
  const theme = useTheme();
  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
       <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
        {icon}
       </Box>
       <Box>
         <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>{label}</Typography>
         <Typography variant="body1" sx={{ fontWeight: 800 }}>{value}</Typography>
       </Box>
    </Box>
  );
}
