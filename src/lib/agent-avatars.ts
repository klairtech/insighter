// AI-generated human face avatars for agents
export const AGENT_AVATARS = [
  { 
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Alex" 
  },
  { 
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Sarah" 
  },
  { 
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Michael" 
  },
  { 
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Emma" 
  },
  { 
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "David" 
  },
  { 
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Lisa" 
  },
  { 
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "James" 
  },
  { 
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Sophia" 
  },
  { 
    image: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Ryan" 
  },
  { 
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Olivia" 
  },
  { 
    image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Chris" 
  },
  { 
    image: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Maya" 
  },
  { 
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Jordan" 
  },
  { 
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Taylor" 
  },
  { 
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Casey" 
  },
  { 
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Morgan" 
  },
  { 
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Riley" 
  },
  { 
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Avery" 
  },
  { 
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Quinn" 
  },
  { 
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format&q=80", 
    name: "Sage" 
  }
];

// Function to get a consistent avatar for an agent based on their ID
export function getAgentAvatar(agentId: string) {
  const hash = agentId.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  return AGENT_AVATARS[Math.abs(hash) % AGENT_AVATARS.length];
}

// Function to get a random avatar (useful for new agent creation)
export function getRandomAgentAvatar() {
  const randomIndex = Math.floor(Math.random() * AGENT_AVATARS.length);
  return AGENT_AVATARS[randomIndex];
}
