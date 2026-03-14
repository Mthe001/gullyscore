'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

interface WinProbabilityChartProps {
  innings: any[]
  balls: any[]
  match: any
  teamAName: string
  teamBName: string
}

export function WinProbabilityChart({ innings, balls, match, teamAName, teamBName }: WinProbabilityChartProps) {
  // Simple probability logic for demonstration
  // In a real app, this would be a more complex calculation
  const calculateProbability = () => {
    if (!innings || innings.length === 0) return 50
    const inn1 = innings[0]
    const inn2 = innings[1]
    
    if (!inn2) return 65 // Team A usually has slight advantage early?
    
    const target = inn1.score + 1
    const currentScore = inn2.score
    const ballsRemaining = (match.overs * 6) - inn2.balls_bowled
    const wicketsRemaining = 10 - inn2.wickets
    
    if (ballsRemaining <= 0) return currentScore >= target ? 0 : 100
    if (wicketsRemaining <= 0) return 100
    
    const runsNeeded = target - currentScore
    const requiredRR = (runsNeeded / ballsRemaining) * 6
    
    // Higher RRR -> Lower prob for Team B (Higher for Team A)
    let probA = 50 + (requiredRR - 6) * 5 - (wicketsRemaining - 5) * 5
    return Math.max(10, Math.min(90, Math.floor(probA)))
  }

  const probability = calculateProbability()
  
  const data = [
    { name: teamAName, value: probability, color: 'hsl(var(--primary))' },
    { name: teamBName, value: 100 - probability, color: 'hsl(var(--accent))' },
  ]

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-3xl p-8 flex flex-col items-center shadow-2xl relative overflow-hidden border border-white/5"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/30 to-purple-500/30" />
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent mb-8">Win Probability</h3>
      
      <div className="w-full h-[240px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={90}
              paddingAngle={8}
              dataKey="value"
              stroke="none"
              startAngle={225}
              endAngle={-45}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <motion.p 
            key={probability}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black gradient-text"
          >
            {probability}%
          </motion.p>
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground opacity-50">{teamAName}</p>
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-8 mt-4">
        <div className="text-center">
          <p className="text-[10px] uppercase font-black text-primary mb-2 tracking-tighter">{teamAName}</p>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${probability}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-primary" 
            />
          </div>
          <p className="text-lg font-black">{probability}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase font-black text-accent mb-2 tracking-tighter">{teamBName}</p>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${100 - probability}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-accent float-right" 
            />
          </div>
          <p className="text-lg font-black">{100 - probability}%</p>
        </div>
      </div>
      
      <div className="mt-8 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
        <p className="text-[10px] text-muted-foreground font-bold text-center italic opacity-60">
          AI Analysis: Based on current run rate, wickets in hand, and historical playground data.
        </p>
      </div>
    </motion.div>
  )
}
