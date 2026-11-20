export type Resource = {
  title: string;
  url: string;
  kind: "Course" | "Documentation" | "Video" | "Paper" | "Repository" | "Reference";
  note?: string;
};

export type CurriculumWeek = {
  week: number;
  phase: number;
  title: string;
  summary: string;
  objectives: string[];
  topics: string[];
  mathematics: string[];
  vocabulary: string[];
  lectures: string[];
  readings: string[];
  paper?: string;
  coding: string[];
  activity: string;
  assignment: string;
  assessment: string[];
  build: string;
  resources: Resource[];
};

const r = (title: string, url: string, kind: Resource["kind"], note?: string): Resource => ({ title, url, kind, note });

export const phases = [
  { id: 1, title: "Mathematical Foundations", subtitle: "Build the language and intuition behind machine learning.", weeks: [1, 2, 3, 4] },
  { id: 2, title: "Probability, Statistics & Data", subtitle: "Reason about uncertainty and turn raw data into useful evidence.", weeks: [5, 6, 7, 8] },
  { id: 3, title: "Classical Machine Learning", subtitle: "Learn the core modeling patterns and when to use them.", weeks: [9, 10, 11, 12] },
  { id: 4, title: "Advanced ML & Deep Learning", subtitle: "Understand how neural networks learn and how to train them well.", weeks: [13, 14, 15, 16] },
  { id: 5, title: "Modern AI Architectures", subtitle: "Explore computer vision, language, sequences, and transformers.", weeks: [17, 18, 19, 20] },
  { id: 6, title: "Applied AI Engineering", subtitle: "Turn research ideas into evaluated, responsible applications.", weeks: [21, 22, 23, 24] },
];

export const curriculum: CurriculumWeek[] = [
  {
    week: 1, phase: 1, title: "Mathematical Foundations", summary: "Get comfortable reading the language of mathematics and build a visual intuition for functions.",
    objectives: ["Read and manipulate algebraic expressions", "Interpret functions and their graphs", "Use logarithms, exponents, and summations", "Translate between notation and plain language"],
    topics: ["Algebra", "Functions", "Logarithms", "Exponents", "Summations", "Coordinate systems", "Mathematical notation"],
    mathematics: ["Function composition and inverse functions", "Log rules: log(ab) = log(a) + log(b)", "Sigma notation and finite sums", "Cartesian coordinates and slopes"],
    vocabulary: ["Domain", "Range", "Function", "Logarithm", "Summation", "Coordinate system"],
    lectures: ["3Blue1Brown — Essence of Algebra"],
    readings: ["Khan Academy — Algebra and functions"],
    coding: ["Plot linear, quadratic, exponential, and logarithmic functions", "Add sliders to change parameters and observe graph behaviour"],
    activity: "Explain one equation in words, then sketch how its graph changes when a parameter changes.",
    assignment: "Create a short, annotated notebook that compares linear, exponential, and logarithmic growth.",
    assessment: ["What does the slope of a line represent?", "Why are logarithms useful for comparing very large values?", "Expand the sum notation for the first four terms."],
    build: "Mathematical visualiser",
    resources: [r("3Blue1Brown", "https://www.3blue1brown.com/", "Video"), r("Mathematics for Machine Learning", "https://www.coursera.org/specializations/mathematics-for-machine-learning", "Course", "May require paid enrollment."), r("Khan Academy: Statistics & Probability", "https://www.khanacademy.org/math/statistics-probability", "Course", "Free learning resource.")]
  },
  {
    week: 2, phase: 1, title: "Linear Algebra I", summary: "Work with the objects used to represent data, parameters, and transformations.",
    objectives: ["Distinguish scalars, vectors, matrices, and tensors", "Calculate dot products and matrix products", "Use NumPy to represent and transform arrays"],
    topics: ["Scalars", "Vectors", "Matrices", "Dot products", "Matrix multiplication", "Tensors", "NumPy operations"],
    mathematics: ["Vector addition and scalar multiplication", "Dot product and geometric interpretation", "Matrix-vector and matrix-matrix multiplication", "Shape compatibility"],
    vocabulary: ["Scalar", "Vector", "Matrix", "Tensor", "Dimension", "Dot product"],
    lectures: ["3Blue1Brown — Vectors and linear combinations", "3Blue1Brown — Linear transformations and matrices"],
    readings: ["NumPy quickstart — arrays and operations"],
    coding: ["Represent a small dataset as a matrix", "Implement vector addition, dot product, and matrix multiplication with NumPy"],
    activity: "Annotate every array with its shape and explain what each axis represents.",
    assignment: "Implement fundamental linear algebra operations using NumPy and verify them against known examples.",
    assessment: ["What does a vector's dimension tell you?", "When is a matrix product defined?", "Describe the dot product geometrically."],
    build: "NumPy linear algebra toolkit",
    resources: [r("3Blue1Brown: Linear Algebra", "https://www.3blue1brown.com/topics/linear-algebra", "Video"), r("NumPy Learn", "https://numpy.org/learn/", "Documentation"), r("NumPy Quickstart", "https://numpy.org/doc/stable/user/quickstart.html", "Documentation")]
  },
  {
    week: 3, phase: 1, title: "Linear Algebra II", summary: "Move beyond mechanics into vector spaces, transformations, projections, and PCA.",
    objectives: ["Describe span, basis, rank, and dimension", "Interpret linear transformations", "Explain eigenvectors and eigenvalues", "Connect orthogonal projection to PCA"],
    topics: ["Vector spaces", "Basis", "Rank", "Linear transformations", "Eigenvalues and eigenvectors", "Orthogonality", "Projections", "Principal Component Analysis"],
    mathematics: ["Linear independence and span", "Rank-nullity intuition", "Eigen equation Av = λv", "Orthogonal projection", "Covariance and principal directions"],
    vocabulary: ["Span", "Basis", "Rank", "Eigenvector", "Eigenvalue", "Orthogonality", "Projection", "Explained variance"],
    lectures: ["3Blue1Brown — Eigenvectors and eigenvalues", "StatQuest — PCA clearly explained"],
    readings: ["Mathematics for Machine Learning — Principal Component Analysis"],
    paper: "Pearson, K. (1901). On Lines and Planes of Closest Fit to Systems of Points in Space.",
    coding: ["Visualise a linear transformation of a 2D grid", "Fit PCA with NumPy and compare with scikit-learn"],
    activity: "Project a cloud of points onto a line and describe what information is retained or lost.",
    assignment: "Analyse and implement PCA on a small dataset; explain each transformation and the explained variance.",
    assessment: ["What makes a set of vectors a basis?", "What does an eigenvector preserve under a transformation?", "How does PCA choose a projection direction?"],
    build: "PCA visual exploration",
    resources: [r("3Blue1Brown: Essence of Linear Algebra", "https://www.3blue1brown.com/topics/linear-algebra", "Video"), r("Mathematics for Machine Learning", "https://mml-book.github.io/", "Reference"), r("PCA paper (historical)", "https://doi.org/10.1080/14786440109462720", "Paper")]
  },
  {
    week: 4, phase: 1, title: "Calculus and Optimisation", summary: "Understand how derivatives describe change and how gradients guide learning.",
    objectives: ["Interpret derivatives and partial derivatives", "Apply the chain rule", "Use gradients to find a descent direction", "Implement and visualise gradient descent"],
    topics: ["Limits", "Derivatives", "Partial derivatives", "Chain rule", "Gradients", "Jacobians", "Gradient descent", "Optimisation"],
    mathematics: ["Derivative as local rate of change", "Partial derivatives and gradient vectors", "Multivariable chain rule", "Learning rate and convergence"],
    vocabulary: ["Limit", "Derivative", "Gradient", "Jacobian", "Loss", "Learning rate", "Convergence"],
    lectures: ["3Blue1Brown — Essence of Calculus", "StatQuest — Gradient descent"],
    readings: ["Dive into Deep Learning — Numerical stability and gradients"],
    coding: ["Approximate a derivative with finite differences", "Implement gradient descent for a one-parameter regression problem"],
    activity: "Plot a loss curve and compare how small, useful, and excessive learning rates behave.",
    assignment: "Implement gradient descent from scratch and document convergence, learning-rate choice, and failure cases.",
    assessment: ["What does a gradient point toward?", "Why does the chain rule matter in neural networks?", "What can happen when the learning rate is too large?"],
    build: "Gradient descent visualiser",
    resources: [r("3Blue1Brown: Calculus", "https://www.3blue1brown.com/topics/calculus", "Video"), r("Mathematics for Machine Learning", "https://mml-book.github.io/", "Reference")]
  },
  {
    week: 5, phase: 2, title: "Probability", summary: "Represent uncertainty, update beliefs with evidence, and reason about random outcomes.",
    objectives: ["Apply conditional probability and Bayes' theorem", "Distinguish independence from mutual exclusivity", "Describe random variables and common distributions"],
    topics: ["Probability theory", "Conditional probability", "Bayes' theorem", "Independence", "Random variables", "Probability distributions"],
    mathematics: ["P(A|B) = P(A∩B)/P(B)", "Bayes' theorem", "Bernoulli and categorical variables", "Expectation of a discrete random variable"],
    vocabulary: ["Prior", "Likelihood", "Posterior", "Conditional probability", "Independence", "Random variable"],
    lectures: ["StatQuest — Bayes theorem, clearly explained"],
    readings: ["Khan Academy — Probability"],
    coding: ["Simulate coin and spam-label experiments", "Compare empirical frequencies with theoretical probabilities"],
    activity: "Draw a probability tree for a real screening or classification scenario and identify base-rate effects.",
    assignment: "Build a Bayesian spam classifier and explain how evidence updates a prior probability.",
    assessment: ["State Bayes' theorem in words.", "What does independence mean?", "Why can a highly accurate test still produce many false positives?"],
    build: "Bayesian spam classifier",
    resources: [r("Khan Academy: Probability", "https://www.khanacademy.org/math/statistics-probability", "Course"), r("Think Bayes", "https://allendowney.github.io/ThinkBayes2/", "Reference")]
  },
  {
    week: 6, phase: 2, title: "Statistics", summary: "Summarise data responsibly and quantify the uncertainty in conclusions.",
    objectives: ["Choose useful descriptive statistics", "Explain expectation, variance, and sampling", "Interpret confidence intervals and hypothesis tests"],
    topics: ["Descriptive statistics", "Distributions", "Expectation", "Variance", "Sampling", "Confidence intervals", "Hypothesis testing"],
    mathematics: ["Mean, median, quantiles", "Variance and standard deviation", "Sampling distributions", "Confidence intervals and p-values"],
    vocabulary: ["Estimator", "Bias", "Variance", "Sample", "Confidence interval", "Null hypothesis", "p-value"],
    lectures: ["StatQuest — Statistics fundamentals"],
    readings: ["OpenIntro Statistics — sampling and inference"],
    coding: ["Compute summaries and bootstrap confidence intervals", "Compare distributions with plots"],
    activity: "Take repeated samples from a population and observe how sample statistics vary.",
    assignment: "Complete a statistical analysis of a real dataset; report uncertainty, assumptions, and limitations.",
    assessment: ["Why is the median robust to outliers?", "What does a confidence interval describe?", "Does a small p-value measure effect size?"],
    build: "Statistical dataset analysis",
    resources: [r("Khan Academy: Statistics & Probability", "https://www.khanacademy.org/math/statistics-probability", "Course"), r("OpenIntro Statistics", "https://www.openintro.org/book/os/", "Reference")]
  },
  {
    week: 7, phase: 2, title: "Python for Machine Learning", summary: "Build maintainable Python workflows for data and experiments.",
    objectives: ["Structure code using functions and modules", "Handle expected errors clearly", "Use NumPy and Pandas for data work", "Organise a small reproducible project"],
    topics: ["Functions", "Object-oriented programming", "Modules", "Exceptions", "NumPy", "Pandas", "Python project structure"],
    mathematics: ["Numerical precision", "Vectorised operations", "Algorithmic complexity basics"],
    vocabulary: ["Module", "Package", "Exception", "DataFrame", "Vectorisation", "Reproducibility"],
    lectures: ["Kaggle Learn — Python"],
    readings: ["Pandas getting started", "NumPy beginner guide"],
    coding: ["Refactor notebook code into reusable functions", "Add input validation and meaningful exception messages"],
    activity: "Pair-program a small data utility; review naming, tests, and documentation.",
    assignment: "Create a reusable data-processing pipeline with a clear project structure and a short README.",
    assessment: ["Why split code into modules?", "When is vectorisation useful?", "How should a pipeline handle invalid input?"],
    build: "Data-processing pipeline",
    resources: [r("Kaggle Learn: Python", "https://www.kaggle.com/learn/python", "Course"), r("NumPy Learn", "https://numpy.org/learn/", "Documentation"), r("Pandas getting started", "https://pandas.pydata.org/docs/getting_started/index.html", "Documentation")]
  },
  {
    week: 8, phase: 2, title: "Data Processing and Exploration", summary: "Inspect data quality, uncover patterns, and prevent preprocessing mistakes.",
    objectives: ["Handle missing values and outliers thoughtfully", "Choose encodings and scaling methods", "Explore relationships without confusing correlation and causation"],
    topics: ["Data cleaning", "Missing values", "Outliers", "Encoding", "Feature scaling", "Correlation", "Data visualisation", "Exploratory Data Analysis"],
    mathematics: ["Standardisation and min-max scaling", "Correlation coefficients", "Robust summaries and distributions"],
    vocabulary: ["Imputation", "Outlier", "Encoding", "Normalisation", "Correlation", "Data leakage"],
    lectures: ["Kaggle Learn — Data Cleaning and Data Visualization"],
    readings: ["Pandas visualization guide", "Scikit-learn preprocessing"],
    coding: ["Inspect missingness and distributions", "Build a preprocessing pipeline fit only on training data"],
    activity: "Write an EDA narrative with three findings and one uncertainty or data-quality concern.",
    assignment: "Produce a Kaggle-style EDA notebook with reproducible cleaning decisions and clear visualisations.",
    assessment: ["Why fit a scaler on training data only?", "When is median imputation preferable?", "What can a correlation plot not establish?"],
    build: "Exploratory data analysis notebook",
    resources: [r("Kaggle Learn", "https://www.kaggle.com/learn", "Course"), r("Pandas getting started", "https://pandas.pydata.org/docs/getting_started/index.html", "Documentation"), r("Matplotlib tutorials", "https://matplotlib.org/stable/tutorials/index.html", "Documentation")]
  },
  {
    week: 9, phase: 3, title: "Machine Learning Foundations", summary: "Frame a problem, establish a baseline, and understand the ML workflow.",
    objectives: ["Distinguish supervised, unsupervised, and reinforcement learning", "Separate features, labels, and data splits", "Identify leakage and establish a baseline"],
    topics: ["Supervised learning", "Unsupervised learning", "Reinforcement learning overview", "Datasets", "Features and labels", "Training, validation and testing", "ML workflow"],
    mathematics: ["Empirical risk minimisation", "Generalisation", "Train/validation/test partitioning"],
    vocabulary: ["Feature", "Label", "Baseline", "Generalisation", "Overfitting", "Data leakage"],
    lectures: ["Google Machine Learning Crash Course — framing"],
    readings: ["Scikit-learn — Getting Started"],
    coding: ["Trace data flow through a compact ML repository", "Reproduce a baseline and write down its assumptions"],
    activity: "Choose one repository and answer the ten guided codebase-analysis questions.",
    assignment: "Analyse a real ML GitHub repository and explain the problem, architecture, algorithms, data, evaluation, limitations, and possible improvements.",
    assessment: ["Why keep a test set separate?", "Give one example of leakage.", "What makes a useful baseline?"],
    build: "ML GitHub repository analysis",
    resources: [r("Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course", "Course"), r("Stanford CS229", "https://cs229.stanford.edu/", "Course"), r("Scikit-learn User Guide", "https://scikit-learn.org/stable/user_guide.html", "Documentation")]
  },
  {
    week: 10, phase: 3, title: "Regression", summary: "Predict continuous outcomes and interpret the trade-offs in model fit.",
    objectives: ["Fit and interpret linear and polynomial regression", "Compare MAE and MSE", "Explain regularisation and its effect on coefficients"],
    topics: ["Linear regression", "Multiple regression", "Polynomial regression", "MSE", "MAE", "Gradient descent", "Ridge regression", "Lasso regression"],
    mathematics: ["Least squares objective", "Mean absolute and squared error", "L1 and L2 penalties"],
    vocabulary: ["Residual", "Coefficient", "Regularisation", "Ridge", "Lasso", "Multicollinearity"],
    lectures: ["StatQuest — Linear regression", "StatQuest — Ridge and Lasso"],
    readings: ["Scikit-learn — Linear Models"],
    coding: ["Fit a baseline and inspect residual plots", "Compare regularised models across a validation split"],
    activity: "Investigate how a high-degree polynomial changes training versus validation error.",
    assignment: "Train a house-price prediction model, compare models with an appropriate metric, and explain error patterns.",
    assessment: ["Why can MSE overemphasise large errors?", "What does L1 regularisation encourage?", "How do residuals help diagnose a model?"],
    build: "House-price prediction model",
    resources: [r("Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course", "Course"), r("Scikit-learn linear models", "https://scikit-learn.org/stable/modules/linear_model.html", "Documentation")]
  },
  {
    week: 11, phase: 3, title: "Classification", summary: "Predict categories, choose thresholds, and reason about the cost of errors.",
    objectives: ["Compare common classification algorithms", "Interpret predicted probabilities and decision boundaries", "Select metrics based on error costs"],
    topics: ["Logistic regression", "Decision trees", "Random forests", "K-nearest neighbours", "Support Vector Machines", "Naive Bayes"],
    mathematics: ["Sigmoid and log-odds", "Entropy and information gain", "Margins and distance", "Bayes decision rule"],
    vocabulary: ["Class", "Threshold", "Decision boundary", "Entropy", "Margin", "Calibration"],
    lectures: ["StatQuest — Logistic regression", "StatQuest — Decision trees and random forests"],
    readings: ["Scikit-learn — Supervised learning"],
    coding: ["Train three classifiers on the same split", "Compare decision boundaries and per-class metrics"],
    activity: "Discuss which errors matter most in a chosen classification use case.",
    assignment: "Build and evaluate a classification model; justify model and threshold choice with a confusion matrix and class-aware metrics.",
    assessment: ["Why is accuracy weak on imbalanced data?", "How does KNN depend on feature scaling?", "What does probability calibration mean?"],
    build: "Comparative classification model",
    resources: [r("Scikit-learn User Guide", "https://scikit-learn.org/stable/user_guide.html", "Documentation"), r("Stanford CS229", "https://cs229.stanford.edu/", "Course")]
  },
  {
    week: 12, phase: 3, title: "Unsupervised Learning", summary: "Find structure without labels and communicate what clusters do—and do not—mean.",
    objectives: ["Compare K-Means, hierarchical clustering, and DBSCAN", "Use dimensionality reduction for exploration", "Evaluate clustering limitations"],
    topics: ["K-Means", "Hierarchical clustering", "DBSCAN", "Dimensionality reduction", "PCA applications"],
    mathematics: ["Euclidean distance", "Within-cluster sum of squares", "Linkage and density", "Silhouette intuition"],
    vocabulary: ["Cluster", "Centroid", "Density", "Linkage", "Silhouette", "Dimensionality reduction"],
    lectures: ["StatQuest — K-means clustering", "StatQuest — PCA"],
    readings: ["Scikit-learn — Clustering"],
    coding: ["Compare clustering algorithms on datasets with different shapes", "Visualise cluster assignments and limitations"],
    activity: "Challenge an apparently convincing clustering result: what changes when the scale or distance metric changes?",
    assignment: "Build a clustering application, justify preprocessing and algorithm choice, and explain why clusters are not ground truth.",
    assessment: ["Why does K-Means struggle with non-spherical groups?", "How does DBSCAN treat noise?", "Why scale features before distance-based clustering?"],
    build: "Clustering application",
    resources: [r("Scikit-learn clustering guide", "https://scikit-learn.org/stable/modules/clustering.html", "Documentation"), r("Papers With Code", "https://paperswithcode.com/", "Reference")]
  },
  {
    week: 13, phase: 4, title: "Model Evaluation", summary: "Evaluate generalisation honestly, choose useful metrics, and avoid hidden leakage.",
    objectives: ["Interpret confusion matrices and threshold-dependent metrics", "Use cross-validation appropriately", "Diagnose bias, variance, and leakage"],
    topics: ["Confusion matrix", "Precision", "Recall", "F1 score", "ROC-AUC", "Cross-validation", "Bias and variance", "Data leakage"],
    mathematics: ["Precision-recall trade-off", "F1 harmonic mean", "ROC curve and AUC", "Validation error estimation"],
    vocabulary: ["Precision", "Recall", "Specificity", "F1", "ROC-AUC", "Cross-validation", "Leakage"],
    lectures: ["StatQuest — Sensitivity and specificity", "Google ML Crash Course — classification metrics"],
    readings: ["Scikit-learn — Model evaluation"],
    coding: ["Compare metrics across imbalanced classes", "Build a cross-validation pipeline and verify no preprocessing leakage"],
    activity: "Write a model card draft explaining evaluation data, metrics, and known limits.",
    assignment: "Compare multiple models using cross-validation, explain bias/variance, and audit the full pipeline for leakage.",
    assessment: ["When is recall more important than precision?", "What does ROC-AUC not tell you about calibration?", "Name a subtle leakage pathway."],
    build: "Model evaluation report",
    resources: [r("Scikit-learn model evaluation", "https://scikit-learn.org/stable/modules/model_evaluation.html", "Documentation"), r("Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course", "Course")]
  },
  {
    week: 14, phase: 4, title: "Neural Network Foundations", summary: "Build an intuitive picture of layers, weights, biases, and nonlinear activation.",
    objectives: ["Describe a perceptron and multilayer network", "Explain why activation functions matter", "Implement a small forward pass with NumPy"],
    topics: ["Perceptrons", "Neurons", "Weights", "Biases", "Activation functions", "Multilayer perceptrons"],
    mathematics: ["Affine transformation z = Wx + b", "Nonlinear activations", "Layer composition"],
    vocabulary: ["Neuron", "Weight", "Bias", "Activation", "Logit", "Multilayer perceptron"],
    lectures: ["3Blue1Brown — Neural networks", "StatQuest — Neural networks"],
    readings: ["Dive into Deep Learning — MLPs"],
    coding: ["Implement a two-layer forward pass with NumPy", "Compare sigmoid, tanh, and ReLU outputs"],
    activity: "Draw a network and annotate the shape of every weight matrix.",
    assignment: "Implement a small neural network using NumPy and explain each parameter and activation.",
    assessment: ["Why does a network need nonlinear activations?", "What does a bias term allow?", "How does layer width affect representation?"],
    build: "NumPy neural network",
    resources: [r("3Blue1Brown: Neural Networks", "https://www.3blue1brown.com/topics/neural-networks", "Video"), r("Deep Learning Book", "https://www.deeplearningbook.org/", "Reference")]
  },
  {
    week: 15, phase: 4, title: "Neural Network Training", summary: "Follow the computational graph to understand backpropagation and optimisation.",
    objectives: ["Trace forward and backward propagation", "Derive gradients for a small network", "Compare SGD and Adam conceptually"],
    topics: ["Forward propagation", "Backpropagation", "Computational graphs", "Loss functions", "Stochastic Gradient Descent", "Adam optimiser"],
    mathematics: ["Chain rule through a graph", "Gradient of common losses", "Mini-batch gradients", "Adaptive learning-rate intuition"],
    vocabulary: ["Backpropagation", "Gradient", "Loss function", "SGD", "Momentum", "Adam", "Batch"],
    lectures: ["3Blue1Brown — Backpropagation", "Karpathy — Neural networks: zero to hero"],
    readings: ["Dive into Deep Learning — Optimization"],
    coding: ["Implement backpropagation for a tiny network", "Check gradients with finite differences"],
    activity: "Compare training curves and explain what changes when batch size or learning rate changes.",
    assignment: "Train a neural network from scratch; validate gradients numerically and document the optimisation choices.",
    assessment: ["Why is backpropagation an application of the chain rule?", "What does an optimiser update?", "Why compare analytical and numerical gradients?"],
    build: "Train a neural network from scratch",
    resources: [r("Karpathy: Neural Networks Zero to Hero", "https://karpathy.ai/zero-to-hero.html", "Course"), r("Deep Learning Book", "https://www.deeplearningbook.org/", "Reference")]
  },
  {
    week: 16, phase: 4, title: "PyTorch", summary: "Use tensors, autograd, data loaders, and training loops to build a complete model.",
    objectives: ["Work with tensor shapes and devices", "Use autograd safely", "Build a reproducible training and evaluation loop"],
    topics: ["Tensors", "Autograd", "Datasets", "DataLoaders", "Training loops", "Model evaluation"],
    mathematics: ["Tensor operations", "Gradient accumulation", "Batch loss and optimisation"],
    vocabulary: ["Tensor", "Autograd", "Dataset", "DataLoader", "Epoch", "Device"],
    lectures: ["PyTorch official tutorials — Learn the Basics"],
    readings: ["PyTorch tutorials — Quickstart"],
    coding: ["Build a training loop with train/eval modes", "Track loss and accuracy without leaking test-set feedback"],
    activity: "Reproduce one small run with fixed seeds and describe what is and is not deterministic.",
    assignment: "Train an MNIST classifier, report evaluation results, and include a short error analysis.",
    assessment: ["Why use no-grad mode for evaluation?", "What does an epoch mean?", "How do DataLoaders help with batching?"],
    build: "MNIST classification model",
    resources: [r("PyTorch Tutorials", "https://pytorch.org/tutorials/", "Documentation"), r("PyTorch Quickstart", "https://pytorch.org/tutorials/beginner/basics/quickstart_tutorial.html", "Documentation")]
  },
  {
    week: 17, phase: 5, title: "Computer Vision", summary: "Understand image tensors and how convolutional networks use local structure.",
    objectives: ["Represent images as tensors", "Explain convolution and pooling", "Train and evaluate a small image classifier"],
    topics: ["Image representation", "Convolution", "Filters and kernels", "Pooling", "CNN architecture", "Image classification"],
    mathematics: ["Discrete convolution", "Receptive fields", "Channels, stride, padding"],
    vocabulary: ["Kernel", "Feature map", "Channel", "Stride", "Padding", "Receptive field"],
    lectures: ["Stanford CS231n — Convolutional Neural Networks"],
    readings: ["PyTorch tutorials — image classification"],
    coding: ["Visualise convolution kernels on sample images", "Train a compact CNN and inspect misclassified examples"],
    activity: "Discuss how dataset composition and image resolution affect model behaviour.",
    assignment: "Train an image classifier and report per-class performance, examples of errors, and data limitations.",
    assessment: ["What controls a convolution's receptive field?", "Why use pooling or strided convolutions?", "What can an image classifier's accuracy conceal?"],
    build: "Image classifier",
    resources: [r("Stanford CS231n", "https://cs231n.stanford.edu/", "Course"), r("PyTorch Tutorials", "https://pytorch.org/tutorials/", "Documentation")]
  },
  {
    week: 18, phase: 5, title: "Natural Language Processing", summary: "Transform text into useful representations and build a transparent text classifier.",
    objectives: ["Compare tokenisation approaches", "Build bag-of-words and TF-IDF features", "Explain what static embeddings capture and miss"],
    topics: ["Text preprocessing", "Tokenisation", "N-grams", "Bag of Words", "TF-IDF", "Word2Vec", "Text classification"],
    mathematics: ["Term frequency and inverse document frequency", "Cosine similarity", "Sparse vector representations"],
    vocabulary: ["Token", "N-gram", "Corpus", "TF-IDF", "Embedding", "Vocabulary"],
    lectures: ["Stanford CS224N — Word Vectors", "Hugging Face NLP Course — preprocessing"],
    readings: ["Hugging Face NLP Course — Chapter 2"],
    coding: ["Compare tokenisation and vocabulary choices", "Build a TF-IDF sentiment baseline and inspect influential features"],
    activity: "Find examples where preprocessing removes meaningful information or introduces bias.",
    assignment: "Create a sentiment analysis model and compare a sparse baseline with a learned representation.",
    assessment: ["How does IDF downweight common words?", "What information do n-grams add?", "What is one limitation of static embeddings?"],
    build: "Sentiment analysis model",
    resources: [r("Stanford CS224N", "https://web.stanford.edu/class/cs224n/", "Course"), r("Hugging Face NLP Course", "https://huggingface.co/learn/nlp-course", "Course")]
  },
  {
    week: 19, phase: 5, title: "Sequence Models", summary: "Model ordered data and understand the limitations of recurrent networks.",
    objectives: ["Explain hidden state in an RNN", "Compare RNN, LSTM, and GRU", "Recognise vanishing-gradient challenges"],
    topics: ["Sequence modelling", "RNN", "LSTM", "GRU", "Vanishing gradients", "Sequence prediction"],
    mathematics: ["Recurrence relations", "Backpropagation through time", "Gated updates intuition"],
    vocabulary: ["Hidden state", "Recurrent", "Sequence", "Gate", "Vanishing gradient", "Time step"],
    lectures: ["Stanford CS224N — Recurrent Neural Networks"],
    readings: ["Dive into Deep Learning — Recurrent Neural Networks"],
    coding: ["Create a sequence dataset from time-series data", "Train and evaluate a simple recurrent predictor"],
    activity: "Compare forecasts at short and long horizons; note when uncertainty compounds.",
    assignment: "Build a sequence prediction model and compare it with a simple non-neural baseline.",
    assessment: ["What information is carried by hidden state?", "Why can gradients vanish across long sequences?", "How do gates help LSTMs?"],
    build: "Sequence prediction model",
    resources: [r("Stanford CS224N", "https://web.stanford.edu/class/cs224n/", "Course"), r("Dive into Deep Learning", "https://d2l.ai/", "Reference")]
  },
  {
    week: 20, phase: 5, title: "Transformers", summary: "Unpack attention and the components that make transformer architectures effective.",
    objectives: ["Explain Query, Key, and Value projections", "Compute scaled dot-product attention", "Describe positional information and encoder/decoder roles"],
    topics: ["Transformer architecture", "Query, Key and Value", "Self-attention", "Multi-head attention", "Positional encoding", "Encoders and decoders"],
    mathematics: ["Scaled dot-product attention softmax(QKᵀ/√dₖ)V", "Positional encodings", "Attention masks"],
    vocabulary: ["Query", "Key", "Value", "Self-attention", "Head", "Positional encoding", "Mask"],
    lectures: ["3Blue1Brown — Attention in transformers", "The Illustrated Transformer"],
    readings: ["Attention Is All You Need"],
    paper: "Vaswani et al. (2017). Attention Is All You Need.",
    coding: ["Implement a minimal scaled dot-product attention operation", "Inspect attention shapes with a tiny example"],
    activity: "Trace one token's attention weights and discuss why attention is not automatically an explanation.",
    assignment: "Implement and explain a simplified attention mechanism with shape annotations and a worked example.",
    assessment: ["Why scale attention logits?", "What role do positional encodings play?", "What does multi-head attention add?"],
    build: "Simplified attention mechanism",
    resources: [r("Attention Is All You Need", "https://arxiv.org/abs/1706.03762", "Paper"), r("Stanford CS224N", "https://web.stanford.edu/class/cs224n/", "Course"), r("Hugging Face NLP Course", "https://huggingface.co/learn/nlp-course", "Course")]
  },
  {
    week: 21, phase: 6, title: "Large Language Models", summary: "Understand next-token prediction, model adaptation, prompting, and inference trade-offs.",
    objectives: ["Explain pretraining and next-token prediction", "Distinguish fine-tuning from prompting", "Design a small, reproducible open-model experiment"],
    topics: ["Next-token prediction", "Pretraining", "Fine-tuning", "Prompting", "Inference", "Open-source LLMs"],
    mathematics: ["Autoregressive factorisation", "Cross-entropy objective", "Sampling temperature and probability distributions"],
    vocabulary: ["Token", "Context window", "Pretraining", "Fine-tuning", "Inference", "Temperature"],
    lectures: ["Hugging Face NLP Course — Language Models"],
    readings: ["The Illustrated Transformer", "Selected open model documentation"],
    coding: ["Run a small locally available open model if hardware permits", "Compare deterministic and sampled generation settings"],
    activity: "Create a prompt evaluation set and record where outputs fail; avoid sharing sensitive data with hosted models.",
    assignment: "Document an open-source LLM experiment, including model, hardware, prompts, outputs, evaluation, limitations, and cost.",
    assessment: ["What objective is used in causal language-model pretraining?", "Why is prompting not model training?", "What trade-offs change with temperature?"],
    build: "Open-source LLM experiment",
    resources: [r("Hugging Face NLP Course", "https://huggingface.co/learn/nlp-course", "Course"), r("Hugging Face Model Hub", "https://huggingface.co/models", "Reference")]
  },
  {
    week: 22, phase: 6, title: "Embeddings and RAG", summary: "Build a retrieval pipeline that grounds answers in a document collection.",
    objectives: ["Explain embedding spaces and semantic search", "Choose chunking and retrieval strategies", "Evaluate retrieval separately from generation"],
    topics: ["Embeddings", "Vector databases", "Semantic search", "Chunking", "Retrieval-Augmented Generation"],
    mathematics: ["Cosine similarity", "Nearest-neighbour retrieval", "Precision@k and recall@k"],
    vocabulary: ["Embedding", "Vector database", "Chunk", "Retriever", "Grounding", "RAG"],
    lectures: ["Qdrant — RAG fundamentals"],
    readings: ["Qdrant documentation — hybrid search"],
    coding: ["Chunk a small permitted document set", "Build semantic retrieval and inspect relevant and irrelevant results"],
    activity: "Test a question set with answerable and unanswerable queries; inspect retrieved evidence.",
    assignment: "Create a document question-answering system with citations, retrieval evaluation, and an explicit out-of-scope response.",
    assessment: ["Why can chunk size affect retrieval?", "What should happen when no relevant evidence is found?", "How can retrieval quality be evaluated?"],
    build: "Document question-answering system",
    resources: [r("Qdrant documentation", "https://qdrant.tech/documentation/", "Documentation"), r("Hugging Face NLP Course", "https://huggingface.co/learn/nlp-course", "Course")]
  },
  {
    week: 23, phase: 6, title: "AI Engineering and Deployment", summary: "Deliver an AI feature with reliable interfaces, monitoring, and responsible safeguards.",
    objectives: ["Serve a model behind a documented API", "Package an application with Docker", "Plan evaluation, monitoring, and responsible use"],
    topics: ["APIs", "Model serving", "Deployment", "Docker", "Monitoring", "Evaluation", "Responsible AI"],
    mathematics: ["Latency and throughput", "Operational thresholds", "Monitoring distribution shift"],
    vocabulary: ["Endpoint", "Container", "Latency", "Observability", "Drift", "Model card"],
    lectures: ["Docker — Get Started", "Google ML Crash Course — production ML systems"],
    readings: ["Responsible AI documentation and model-card examples"],
    coding: ["Build a small prediction API with input validation", "Containerise and add health checks"],
    activity: "Threat-model the demo: identify misuse, sensitive data, failure modes, and a safe fallback.",
    assignment: "Deploy or locally demonstrate an AI application with tests, evaluation, monitoring plan, and responsible-AI documentation.",
    assessment: ["Why validate API inputs?", "What is model drift?", "What should a service do when inference is unavailable?"],
    build: "Deploy an AI application",
    resources: [r("Docker Get Started", "https://docs.docker.com/get-started/", "Documentation"), r("Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course", "Course"), r("Qdrant documentation", "https://qdrant.tech/documentation/", "Documentation")]
  },
  {
    week: 24, phase: 6, title: "Research and Capstone", summary: "Reproduce, evaluate, and communicate a complete project with evidence and reflection.",
    objectives: ["Form a focused research question", "Reproduce a baseline and document deviations", "Communicate results, limits, and ethical considerations"],
    topics: ["Research methodology", "Paper reproduction", "Benchmarking", "Model comparison", "Technical documentation", "Presentation"],
    mathematics: ["Metric selection", "Uncertainty and repeated runs", "Ablation and controlled comparisons"],
    vocabulary: ["Reproduction", "Benchmark", "Ablation", "Baseline", "Threat to validity", "Ethical review"],
    lectures: ["Papers With Code — reproducibility and benchmarks"],
    readings: ["A relevant primary paper selected with the mentor"],
    coding: ["Reproduce a modest baseline", "Run a controlled comparison and preserve configuration and results"],
    activity: "Peer review a draft: ask whether the evidence supports the claims and what remains uncertain.",
    assignment: "Submit the capstone: problem definition, literature review, dataset and EDA, mathematical justification, implementation, experiments, evaluation, error analysis, limitations, ethics, demo, documentation, and presentation.",
    assessment: ["What makes a reproduction useful when results differ?", "Why report limitations?", "How can a benchmark encourage misleading optimisation?"],
    build: "Final capstone project and research report",
    resources: [r("Papers With Code", "https://paperswithcode.com/", "Reference"), r("Machine Learning GitHub topic", "https://github.com/topics/machine-learning", "Repository"), r("Deep Learning GitHub topic", "https://github.com/topics/deep-learning", "Repository"), r("PyTorch Examples", "https://github.com/pytorch/examples", "Repository"), r("Karpathy micrograd", "https://github.com/karpathy/micrograd", "Repository"), r("Karpathy nanoGPT", "https://github.com/karpathy/nanoGPT", "Repository")]
  }
];

export const allResources = Array.from(
  new Map(curriculum.flatMap((week) => week.resources.map((resource) => [resource.url, resource] as const)).values())
);

export function getWeek(week: number) {
  return curriculum.find((item) => item.week === week);
}
