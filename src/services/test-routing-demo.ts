#!/usr/bin/env node

/**
 * Manual demo script to showcase the enhanced command routing functionality
 * Run this with: npx ts-node src/services/test-routing-demo.ts
 */

import { commandRoutingService } from './commandRouting';

interface TestCase {
  input: string;
  expectedType: 'shell' | 'ai';
  description: string;
  category: string;
}

const testCases: TestCase[] = [
  // Clear shell commands
  { input: 'ls -la', expectedType: 'shell', description: 'Basic file listing', category: 'File Operations' },
  { input: 'git status', expectedType: 'shell', description: 'Git status check', category: 'Development Tools' },
  { input: 'docker ps', expectedType: 'shell', description: 'List Docker containers', category: 'Development Tools' },
  { input: 'npm install react', expectedType: 'shell', description: 'Package installation', category: 'Package Management' },
  { input: 'cd ~/projects', expectedType: 'shell', description: 'Directory navigation', category: 'File Operations' },
  { input: 'ps aux | grep node', expectedType: 'shell', description: 'Process filtering with pipe', category: 'System Operations' },
  { input: 'sudo systemctl restart nginx', expectedType: 'shell', description: 'Service management', category: 'System Operations' },
  { input: './build.sh', expectedType: 'shell', description: 'Script execution', category: 'Shell Scripts' },
  
  // Clear AI queries
  { input: 'what is docker?', expectedType: 'ai', description: 'Definition question', category: 'AI Questions' },
  { input: 'how do I use git?', expectedType: 'ai', description: 'How-to question', category: 'AI Questions' },
  { input: 'explain kubernetes to me', expectedType: 'ai', description: 'Explanation request', category: 'AI Requests' },
  { input: 'help me debug this error', expectedType: 'ai', description: 'Help request', category: 'AI Requests' },
  { input: 'can you suggest a better approach?', expectedType: 'ai', description: 'Suggestion request', category: 'AI Requests' },
  { input: 'I need help with my React application', expectedType: 'ai', description: 'Natural language help', category: 'AI Queries' },
  { input: 'generate a Dockerfile for my app', expectedType: 'ai', description: 'Code generation request', category: 'AI Requests' },
  { input: 'what\'s the best way to optimize this?', expectedType: 'ai', description: 'Question with question mark', category: 'AI Questions' },
  
  // Edge cases and potentially ambiguous inputs
  { input: 'help', expectedType: 'ai', description: 'Ambiguous: could be shell help or AI help', category: 'Edge Cases' },
  { input: 'test', expectedType: 'shell', description: 'Ambiguous: could be test command or AI query', category: 'Edge Cases' },
  { input: 'run', expectedType: 'shell', description: 'Short command-like input', category: 'Edge Cases' },
  { input: 'build', expectedType: 'shell', description: 'Common build command', category: 'Edge Cases' },
  { input: 'history', expectedType: 'shell', description: 'Shell history command', category: 'Edge Cases' },
  { input: 'history of git', expectedType: 'ai', description: 'AI query about git history', category: 'Edge Cases' },
  
  // Natural language equivalents of shell commands
  { input: 'show me the files in this directory', expectedType: 'ai', description: 'Natural language for ls', category: 'Natural Language' },
  { input: 'what containers are running?', expectedType: 'ai', description: 'Natural language for docker ps', category: 'Natural Language' },
  { input: 'list all processes', expectedType: 'ai', description: 'Natural language for ps aux', category: 'Natural Language' },
  { input: 'check git status', expectedType: 'ai', description: 'Natural language for git status', category: 'Natural Language' },
];

async function runDemo() {
  console.log('🚀 Nexus Terminal Command Routing Demo');
  console.log('=====================================\\n');
  
  let correctPredictions = 0;
  let totalTests = 0;
  
  const results: { [category: string]: Array<{
    input: string;
    predicted: string;
    expected: string;
    correct: boolean;
    confidence: number;
    reason: string;
  }> } = {};
  
  for (const testCase of testCases) {
    totalTests++;
    
    try {
      const result = await commandRoutingService.routeCommand(testCase.input);
      const predictedType = result.isShellCommand ? 'shell' : 'ai';
      const isCorrect = predictedType === testCase.expectedType;
      
      if (isCorrect) correctPredictions++;
      
      // Group results by category
      if (!results[testCase.category]) {
        results[testCase.category] = [];
      }
      
      results[testCase.category].push({
        input: testCase.input,
        predicted: predictedType,
        expected: testCase.expectedType,
        correct: isCorrect,
        confidence: result.confidence,
        reason: result.reason
      });
      
    } catch (error) {
      console.error(`❌ Error testing "${testCase.input}":`, error);
    }
  }
  
  // Display results by category
  Object.entries(results).forEach(([category, categoryResults]) => {\n    console.log(`\\n📋 ${category}`);\n    console.log('='.repeat(category.length + 4));\n    \n    categoryResults.forEach(result => {\n      const statusIcon = result.correct ? '✅' : '❌';\n      const confidenceColor = result.confidence > 0.8 ? '🟢' : result.confidence > 0.6 ? '🟡' : '🔴';\n      \n      console.log(`${statusIcon} \"${result.input}\"`);\n      console.log(`   Expected: ${result.expected.toUpperCase()}, Got: ${result.predicted.toUpperCase()}`);\n      console.log(`   Confidence: ${confidenceColor} ${(result.confidence * 100).toFixed(1)}%`);\n      console.log(`   Reason: ${result.reason}`);\n      console.log();\n    });\n  });\n  \n  // Summary\n  const accuracy = (correctPredictions / totalTests * 100).toFixed(1);\n  console.log(`\\n📊 Summary`);\n  console.log('===========');\n  console.log(`Total tests: ${totalTests}`);\n  console.log(`Correct predictions: ${correctPredictions}`);\n  console.log(`Accuracy: ${accuracy}%`);\n  \n  if (parseFloat(accuracy) >= 90) {\n    console.log('🎉 Excellent routing accuracy!');\n  } else if (parseFloat(accuracy) >= 80) {\n    console.log('👍 Good routing accuracy!');\n  } else {\n    console.log('⚠️  Routing accuracy could be improved');\n  }\n  \n  // Show edge cases that need attention\n  const incorrectPredictions = Object.values(results)\n    .flat()\n    .filter(r => !r.correct);\n    \n  if (incorrectPredictions.length > 0) {\n    console.log(`\\n⚠️  Cases that need attention:`);\n    incorrectPredictions.forEach(result => {\n      console.log(`   \"${result.input}\" - Expected: ${result.expected}, Got: ${result.predicted}`);\n    });\n  }\n  \n  // Interactive mode\n  console.log(`\\n🎮 Interactive Mode`);\n  console.log('==================');\n  console.log('Enter commands to test routing (or \"quit\" to exit):');\n  \n  const readline = require('readline');\n  const rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n  });\n  \n  const askForInput = () => {\n    rl.question('> ', async (input: string) => {\n      if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {\n        console.log('👋 Goodbye!');\n        rl.close();\n        return;\n      }\n      \n      if (input.trim()) {\n        try {\n          const result = await commandRoutingService.routeCommand(input);\n          const type = result.isShellCommand ? '🐚 Shell Command' : '🤖 AI Query';\n          const confidenceIcon = result.confidence > 0.8 ? '🟢' : result.confidence > 0.6 ? '🟡' : '🔴';\n          \n          console.log(`   ${type}`);\n          console.log(`   Confidence: ${confidenceIcon} ${(result.confidence * 100).toFixed(1)}%`);\n          console.log(`   Reason: ${result.reason}`);\n          console.log(`   Suggested Action: ${result.suggestedAction.replace('_', ' ').toUpperCase()}`);\n          \n          // Show analysis\n          const analysis = await commandRoutingService.analyzeCommand(input);\n          if (analysis.alternatives.length > 0) {\n            console.log(`   Alternatives: ${analysis.alternatives.join(', ')}`);\n          }\n          console.log();\n          \n        } catch (error) {\n          console.log(`   ❌ Error: ${error}`);\n        }\n      }\n      \n      askForInput();\n    });\n  };\n  \n  askForInput();\n}\n\nif (require.main === module) {\n  runDemo().catch(console.error);\n}\n\nexport { runDemo };
