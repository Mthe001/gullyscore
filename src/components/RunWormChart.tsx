'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { motion } from 'framer-motion'

interface RunWormChartProps {
  data: any[]
  teamAName: string
  teamBName: string
}

export function RunWormChart({ data, teamAName, teamBName }: RunWormChartProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-3xl p-6 h-[400px] shadow-2xl overflow-hidden relative border border-white/5"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500/30 to-teal-500/30" />
      
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-1">Innings Progression</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Comparative Run Worm</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-tight text-primary">
              {teamAName || 'Innings 1'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[10px] font-black uppercase tracking-tight text-accent">
              {teamBName || 'Innings 2'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTeamA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTeamB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis 
              dataKey="over" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }} 
              label={{ value: 'Overs', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
              label={{ value: 'Runs', angle: -90, position: 'insideLeft', offset: 10, fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }}
            />
            <Tooltip 
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              contentStyle={{ 
                background: 'rgba(15, 15, 25, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: '800',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                padding: '12px'
              }}
              itemStyle={{ padding: '2px 0' }}
            />
            <Line 
              type="monotone" 
              dataKey="teamA" 
              name={teamAName || 'Team A'}
              stroke="hsl(var(--primary))" 
              strokeWidth={4} 
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#0a0a0f', fill: 'hsl(var(--primary))' }}
              animationDuration={2000}
            />
            <Line 
              type="monotone" 
              dataKey="teamB" 
              name={teamBName || 'Team B'}
              stroke="hsl(var(--accent))" 
              strokeWidth={4} 
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#0a0a0f', fill: 'hsl(var(--accent))' }}
              animationDuration={2000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex items-center justify-center">
        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.1em] opacity-40">
          * Interactive Chart: Hover to see progressive scores
        </p>
      </div>
    </motion.div>
  )
}
