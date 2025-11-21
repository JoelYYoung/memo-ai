export interface SM2Params {
	ef: number; // E-Factor (difficulty factor)
	repetitions: number;
	intervalDays: number;
	importanceLevel: 'low' | 'medium' | 'high';
}

export interface SM2Result {
	newEf: number;
	newRepetitions: number;
	newIntervalDays: number;
}

export class SM2Algorithm {
	static update(grade: number, params: SM2Params): SM2Result {
		if (grade < 0 || grade > 5) {
			throw new Error("grade must be in range 0..5");
		}

		let newRepetitions = params.repetitions;
		let newIntervalDays = params.intervalDays;
		// E-Factor update formula
		let newEf = Math.max(1.3, params.ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

		if (grade < 3) {
			// Answer incorrect, reset
			newRepetitions = 0;
			newIntervalDays = 1;
		} else {
			// Answer correct, increase repetition count
			newRepetitions = params.repetitions + 1;
			if (newRepetitions === 1) {
				newIntervalDays = 1;
			} else if (newRepetitions === 2) {
				newIntervalDays = 6;
			} else {
				newIntervalDays = Math.max(1, Math.round(params.intervalDays * params.ef));
			}
		}

		// Adjust interval based on importance level
		const importanceMultiplier = this.getImportanceMultiplier(params.importanceLevel);
		newIntervalDays = Math.max(1, Math.round(newIntervalDays * importanceMultiplier));

		return {
			newEf,
			newRepetitions,
			newIntervalDays
		};
	}

	static getImportanceMultiplier(importanceLevel: 'low' | 'medium' | 'high'): number {
		switch (importanceLevel) {
			case 'low':
				return 1.5; // Less important chunks can have longer intervals
			case 'medium':
				return 1.0; // Standard intervals
			case 'high':
				return 0.7; // More important chunks should have shorter intervals
			default:
				return 1.0;
		}
	}

	static calculateFamiliarScore(prevScore: number, grade: number, alpha: number = 0.3): number {
		if (prevScore < 0 || prevScore > 1) {
			prevScore = 0.0;
		}
		const mapped = Math.max(0.0, Math.min(1.0, grade / 5.0));
		return (1 - alpha) * prevScore + alpha * mapped;
	}
}

