import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, Paper, CircularProgress, alpha, useTheme, Avatar, Divider, Button, Chip, Skeleton, Card, CardContent, Stack } from '@mui/material';
import { ShieldCheck, Calendar, User, BookOpen, Clock, CheckCircle, Smartphone, XCircle } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
        console.log(`Verifying ${type} with id: ${id}`);
        
        // 1. Try fetching by document ID
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log("Found by doc ID");
          setData({ id: docSnap.id, ...docSnap.data() });
        } else {
          // 2. Comprehensive search
          console.log("Searching all matching fields...");
          
          if (type === 'receipt') {
            const receiptQueries = [
              query(collection(db, 'receipts'), where('receiptNo', '==', id)),
              query(collection(db, 'receipts'), where('receiptNumber', '==', id))
            ];
            for (const q of receiptQueries) {
              const snap = await getDocs(q);
              if (!snap.empty) {
                setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
                return;
              }
            }
          } else {
            const userQueries = [
              query(collection(db, 'users'), where('uid', '==', id)),
              query(collection(db, 'users'), where('admissionNo', '==', id)),
              query(collection(db, 'users'), where('teacherId', '==', id)),
              query(collection(db, 'users'), where('studentId', '==', id))
            ];
            for (const q of userQueries) {
              const snap = await getDocs(q);
               if (!snap.empty) {
                setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
                return;
              }
            }
          }
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
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 4 }}>
        <Skeleton variant="circular" width={80} height={80} sx={{ mb: 4 }} />
        <Skeleton variant="text" width={200} height={30} />
      </Box>
    );
  }

  if (!id || !type || !data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <XCircle size={64} color={theme.palette.error.main} style={{ marginBottom: 24 }} />
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-heading)' }}>Invalid Entry</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>The scanned document could not be verified.</Typography>
        <Button variant="outlined" onClick={() => window.location.href = '/'} sx={{ borderRadius: 100, px: 4 }}>Back Home</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 450 }}>
        <Card sx={{ borderRadius: 8, boxShadow: theme.palette.mode === 'dark' ? '0 30px 60px rgba(0,0,0,0.5)' : '0 30px 60px rgba(0,0,0,0.05)', border: 'none', overflow: 'hidden' }}>
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.05) }}>
            <CheckCircle size={48} color={theme.palette.success.main} />
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'success.main', letterSpacing: 1 }}>AUTHENTICATED</Typography>
          </Box>
          <CardContent sx={{ p: 4 }}>
            {type === 'receipt' ? (
              <Stack spacing={2.5}>
                <DataRow label="STUDENT" value={data.studentName} />
                <DataRow label="RECEIPT NO" value={data.receiptNo} />
                <DataRow label="AMOUNT" value={`Rs.${data.amount}`} />
                <DataRow label="CATEGORY" value={data.feeHead} />
                <DataRow label="DATE" value={data.date} />
              </Stack>
            ) : (
              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Avatar src={data.photoURL} sx={{ width: 100, height: 100, border: '3px solid', borderColor: 'primary.main' }} />
                </Box>
                <DataRow label="NAME" value={data.displayName} />
                <DataRow label="CLASS" value={data.classLevel} />
                <DataRow label="ID NO" value={data.admissionNo || data.teacherId || 'N/A'} />
                <DataRow label="ROLE" value={data.role?.toUpperCase()} />
              </Stack>
            )}
            <Divider sx={{ my: 3 }} />
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', fontWeight: 800 }}>
              VERIFIED ON: {new Date().toLocaleString()}
            </Typography>
            <Button fullWidth onClick={() => window.location.href = '/'} sx={{ mt: 3, borderRadius: 2, fontWeight: 800 }}>Close</Button>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}

function DataRow({ label, value }: { label: string, value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 0.5 }}>{label}</Typography>
      <Typography variant="body1" sx={{ fontWeight: 800 }}>{value || 'N/A'}</Typography>
    </Box>
  );
}
